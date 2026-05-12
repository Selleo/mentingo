import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  COURSE_CHAT_ALLOWED_REACTIONS,
  COURSE_CHAT_SOCKET_EVENTS,
  PERMISSIONS,
  getCourseChatRoom,
} from "@repo/shared";

import { BaseResponse, PaginatedResponse, DatabasePg } from "src/common";
import { CourseChatPresenceService } from "src/course-chat/course-chat-presence.service";
import {
  CourseChatRepository,
  type CourseChatMessageReactionSummaryRow,
  type CourseChatMessageRow,
  type CourseChatReplyParticipantRow,
  type CourseChatReplySummaryRow,
} from "src/course-chat/course-chat.repository";
import { CourseChatMessageCreatedEvent } from "src/events/course-chat/course-chat-message-created.event";
import { CourseChatReplyCreatedEvent } from "src/events/course-chat/course-chat-reply-created.event";
import { CourseChatUserMentionedEvent } from "src/events/course-chat/course-chat-user-mentioned.event";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { S3Service } from "src/s3/s3.service";
import { REALTIME_PUBLISHER } from "src/websocket/realtime.publisher";

import type { PermissionKey } from "@repo/shared";
import type { UUIDType } from "src/common";
import type {
  CourseChatMessagePreviewResponse,
  CourseChatMessageReactionResponse,
  CourseChatMessageResponse,
  CourseChatUserResponse,
  CreateCourseChatMessageBody,
  DeleteCourseChatMessageResponse,
  ToggleCourseChatMessageReactionBody,
} from "src/course-chat/schemas/course-chat.schema";

type CourseChatRealtimePublisher = {
  emitToRoom(event: string, roomId: string, payload: unknown): void;
};

@Injectable()
export class CourseChatService {
  constructor(
    private readonly courseChatRepository: CourseChatRepository,
    private readonly courseChatPresenceService: CourseChatPresenceService,
    private readonly outboxPublisher: OutboxPublisher,
    @Inject("DB") private readonly db: DatabasePg,
    @Inject(REALTIME_PUBLISHER) private readonly realtimePublisher: CourseChatRealtimePublisher,
    private readonly s3Service?: S3Service,
  ) {}

  async assertUserEnrolledInCourse(courseId: UUIDType, userId: UUIDType) {
    const isEnrolled = await this.courseChatRepository.isUserEnrolledInCourse(courseId, userId);

    if (!isEnrolled) {
      throw new ForbiddenException("courseChat.errors.notEnrolled");
    }
  }

  async getMessages(params: {
    courseId: UUIDType;
    userId: UUIDType;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResponse<CourseChatMessageResponse[]>> {
    await this.assertUserEnrolledInCourse(params.courseId, params.userId);

    const messages = await this.courseChatRepository.getTopLevelMessages(
      params.courseId,
      params.page,
      params.perPage,
    );

    return new PaginatedResponse({
      ...messages,
      data: await this.mapMessages(messages.data, params.userId, { includeReplySummary: true }),
    });
  }

  async getReplies(params: {
    messageId: UUIDType;
    userId: UUIDType;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResponse<CourseChatMessageResponse[]>> {
    const message = await this.getAccessibleMessage(params.messageId, params.userId);
    const replies = await this.courseChatRepository.getReplies(
      message.id,
      params.page,
      params.perPage,
    );

    return new PaginatedResponse({
      ...replies,
      data: await this.mapMessages(replies.data, params.userId, { includeReplySummary: false }),
    });
  }

  async getUsers(
    courseId: UUIDType,
    userId: UUIDType,
  ): Promise<BaseResponse<CourseChatUserResponse[]>> {
    await this.assertUserEnrolledInCourse(courseId, userId);

    const users = await this.courseChatRepository.getEnrolledUsers(courseId);
    const avatarUrlByReference = await this.getAvatarUrlByReference(
      users.map((user) => user.avatarReference),
    );
    const onlineUserIds = await this.courseChatPresenceService.getOnlineUserIds(
      courseId,
      users.map((user) => user.id),
    );

    return new BaseResponse(
      users.map((user) => ({
        ...user,
        avatarReference: this.getMappedAvatarReference(user.avatarReference, avatarUrlByReference),
        isOnline: onlineUserIds.has(user.id),
      })),
    );
  }

  async createMessage(
    courseId: UUIDType,
    userId: UUIDType,
    tenantId: UUIDType,
    body: CreateCourseChatMessageBody,
  ): Promise<BaseResponse<CourseChatMessageResponse>> {
    await this.assertUserEnrolledInCourse(courseId, userId);

    let parentMessage: Awaited<ReturnType<CourseChatRepository["getMessageContext"]>> = null;
    if (body.parentMessageId) {
      parentMessage = await this.courseChatRepository.getMessageContext(body.parentMessageId);

      if (
        !parentMessage ||
        parentMessage.courseId !== courseId ||
        parentMessage.deletedAt ||
        parentMessage.parentMessageId
      ) {
        throw new BadRequestException("courseChat.errors.invalidParentMessage");
      }
    }

    const mentionedUserIds = await this.getMentionedEnrolledUserIds({
      courseId,
      actorUserId: userId,
      mentionedUserIds: body.mentionedUserIds,
    });

    const messageId = await this.db.transaction(async (trx) => {
      const createdMessageId = await this.courseChatRepository.createMessage({
        courseId,
        userId,
        content: this.normalizeContent(body.content),
        parentMessageId: body.parentMessageId,
        parentMessage: parentMessage ?? undefined,
        dbInstance: trx,
      });

      await this.publishMessageCreatedEvent(
        {
          courseId,
          actorUserId: userId,
          messageId: createdMessageId,
          parentMessageId: body.parentMessageId,
        },
        trx,
      );

      await this.publishMentionEvent(
        {
          tenantId,
          courseId,
          actorUserId: userId,
          messageId: createdMessageId,
          mentionedUserIds,
        },
        trx,
      );

      return createdMessageId;
    });

    const message = await this.getMessageResponse(messageId, userId);

    this.realtimePublisher.emitToRoom(
      COURSE_CHAT_SOCKET_EVENTS.MESSAGE_CREATED,
      getCourseChatRoom(courseId),
      message,
    );
    this.emitMentionRealtimeNotifications({
      courseId,
      message,
      mentionedUserIds,
    });

    return new BaseResponse(message);
  }

  async toggleMessageReaction(
    messageId: UUIDType,
    userId: UUIDType,
    body: ToggleCourseChatMessageReactionBody,
  ) {
    if (!this.isAllowedReaction(body.reaction)) {
      throw new BadRequestException("courseChat.errors.invalidReaction");
    }

    const message = await this.courseChatRepository.getMessageContext(messageId);
    if (!message || message.deletedAt || !message.userId) {
      throw new NotFoundException("courseChat.errors.messageNotFound");
    }

    await this.assertUserEnrolledInCourse(message.courseId, userId);

    await this.courseChatRepository.toggleMessageReaction({
      messageId,
      courseId: message.courseId,
      userId,
      reaction: body.reaction,
    });

    const reactions = this.mapReactions(
      await this.courseChatRepository.getMessageReactions(messageId, userId),
    );
    const payload = {
      courseId: message.courseId,
      messageId,
      reactions,
    };

    this.realtimePublisher.emitToRoom(
      COURSE_CHAT_SOCKET_EVENTS.MESSAGE_REACTIONS_UPDATED,
      getCourseChatRoom(message.courseId),
      payload,
    );

    return new BaseResponse(payload);
  }

  async deleteMessage(
    messageId: UUIDType,
    userId: UUIDType,
    permissions: PermissionKey[],
  ): Promise<BaseResponse<DeleteCourseChatMessageResponse>> {
    const message = await this.courseChatRepository.getMessageContext(messageId);
    if (!message || message.deletedAt || !message.userId) {
      throw new NotFoundException("courseChat.errors.messageNotFound");
    }

    await this.assertUserEnrolledInCourse(message.courseId, userId);

    const canDeleteAnyMessage = permissions.includes(PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE);
    const canDeleteOwnMessage =
      message.userId === userId &&
      permissions.includes(PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE_OWN);
    const canDeleteMessage = canDeleteAnyMessage || canDeleteOwnMessage;
    if (!canDeleteMessage) {
      throw new ForbiddenException("courseChat.errors.cannotDeleteMessage");
    }

    const replyCount = message.parentMessageId
      ? 0
      : await this.courseChatRepository.countReplies(message.id);
    const deletedAt = await this.courseChatRepository.softDeleteMessage(message.id);
    const payload = {
      courseId: message.courseId,
      messageId: message.id,
      parentMessageId: message.parentMessageId,
      removed: Boolean(message.parentMessageId || replyCount === 0),
      deletedAt,
    };

    this.realtimePublisher.emitToRoom(
      COURSE_CHAT_SOCKET_EVENTS.MESSAGE_DELETED,
      getCourseChatRoom(message.courseId),
      payload,
    );

    return new BaseResponse(payload);
  }

  private async getAccessibleMessage(messageId: UUIDType, userId: UUIDType) {
    const message = await this.courseChatRepository.getMessageContext(messageId);

    if (!message) {
      throw new NotFoundException("courseChat.errors.messageNotFound");
    }

    await this.assertUserEnrolledInCourse(message.courseId, userId);

    return message;
  }

  private async getMessageResponse(messageId: UUIDType, viewerUserId: UUIDType) {
    const message = await this.courseChatRepository.getMessageById(messageId);
    if (!message) throw new NotFoundException("courseChat.errors.notFound");

    const [mappedMessage] = await this.mapMessages([message], viewerUserId, {
      includeReplySummary: true,
    });

    return mappedMessage;
  }

  private async mapMessages(
    messages: CourseChatMessageRow[],
    viewerUserId: UUIDType,
    options: { includeReplySummary: boolean },
  ): Promise<CourseChatMessageResponse[]> {
    const messageIds = messages.map((message) => message.id);
    const [reactionRows, replySummaries, replyParticipants] = await Promise.all([
      this.courseChatRepository.getMessageReactionsForMessages(messageIds, viewerUserId),
      options.includeReplySummary
        ? this.courseChatRepository.getReplySummaries(messageIds)
        : Promise.resolve([]),
      options.includeReplySummary
        ? this.courseChatRepository.getReplyParticipants(messageIds)
        : Promise.resolve([]),
    ]);
    const latestReplies = replySummaries
      .map((summary) => summary.latestReply)
      .filter((message): message is CourseChatMessageRow => Boolean(message));
    const avatarUrlByReference = await this.getAvatarUrlByReference([
      ...messages.map((message) => message.userAvatarReference),
      ...latestReplies.map((message) => message.userAvatarReference),
      ...replyParticipants.map((participant) => participant.avatarReference),
    ]);
    const latestReplyReactionRows = await this.courseChatRepository.getMessageReactionsForMessages(
      latestReplies.map((reply) => reply.id),
      viewerUserId,
    );

    const reactionsByMessageId = this.groupReactions([...reactionRows, ...latestReplyReactionRows]);
    const replySummaryByMessageId = new Map(
      replySummaries.map((summary) => [summary.parentMessageId, summary]),
    );
    const replyParticipantsByMessageId = this.groupReplyParticipants(replyParticipants);

    return messages.map((message) =>
      this.mapMessage(
        message,
        reactionsByMessageId,
        replySummaryByMessageId,
        replyParticipantsByMessageId,
        avatarUrlByReference,
      ),
    );
  }

  private mapMessage(
    message: CourseChatMessageRow,
    reactionsByMessageId: Map<UUIDType, CourseChatMessageReactionResponse[]>,
    replySummaryByMessageId: Map<UUIDType, CourseChatReplySummaryRow>,
    replyParticipantsByMessageId: Map<UUIDType, CourseChatReplyParticipantRow[]>,
    avatarUrlByReference: Map<string, string>,
  ): CourseChatMessageResponse {
    const replySummary = replySummaryByMessageId.get(message.id);

    return {
      ...this.mapMessagePreview(message, reactionsByMessageId, avatarUrlByReference),
      replyCount: replySummary?.replyCount ?? 0,
      replyParticipants: (replyParticipantsByMessageId.get(message.id) ?? []).map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarReference: this.getMappedAvatarReference(user.avatarReference, avatarUrlByReference),
      })),
      latestReply: replySummary?.latestReply
        ? this.mapMessagePreview(
            replySummary.latestReply,
            reactionsByMessageId,
            avatarUrlByReference,
          )
        : null,
    };
  }

  private mapMessagePreview(
    message: CourseChatMessageRow,
    reactionsByMessageId: Map<UUIDType, CourseChatMessageReactionResponse[]>,
    avatarUrlByReference: Map<string, string>,
  ): CourseChatMessagePreviewResponse {
    return {
      id: message.id,
      courseId: message.courseId,
      userId: message.userId,
      content: message.deletedAt ? "" : message.content,
      parentMessageId: message.parentMessageId,
      deletedAt: message.deletedAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      user: {
        id: message.userIdForProfile,
        firstName: message.userFirstName,
        lastName: message.userLastName,
        avatarReference: this.getMappedAvatarReference(
          message.userAvatarReference,
          avatarUrlByReference,
        ),
      },
      reactions: message.deletedAt ? [] : (reactionsByMessageId.get(message.id) ?? []),
    };
  }

  private groupReplyParticipants(participants: CourseChatReplyParticipantRow[]) {
    const participantsByMessageId = new Map<UUIDType, CourseChatReplyParticipantRow[]>();

    for (const participant of participants) {
      const current = participantsByMessageId.get(participant.parentMessageId) ?? [];
      current.push(participant);
      participantsByMessageId.set(participant.parentMessageId, current);
    }

    return participantsByMessageId;
  }

  private async getAvatarUrlByReference(avatarReferences: (string | null)[]) {
    if (!this.s3Service) return new Map<string, string>();
    const s3Service = this.s3Service;

    const uniqueAvatarReferences = Array.from(
      new Set(avatarReferences.filter((reference): reference is string => Boolean(reference))),
    );

    const avatarEntries = await Promise.all(
      uniqueAvatarReferences.map(
        async (avatarReference): Promise<[string, string]> => [
          avatarReference,
          await s3Service.getSignedUrl(avatarReference),
        ],
      ),
    );

    return new Map(avatarEntries);
  }

  private getMappedAvatarReference(
    avatarReference: string | null,
    avatarUrlByReference: Map<string, string>,
  ) {
    if (!avatarReference) return null;
    return avatarUrlByReference.get(avatarReference) ?? avatarReference;
  }

  private groupReactions(reactions: CourseChatMessageReactionSummaryRow[]) {
    const reactionsByMessageId = new Map<UUIDType, CourseChatMessageReactionResponse[]>();

    for (const reaction of reactions) {
      const current = reactionsByMessageId.get(reaction.messageId) ?? [];
      current.push(...this.mapReactions([reaction]));
      reactionsByMessageId.set(reaction.messageId, current);
    }

    return reactionsByMessageId;
  }

  private mapReactions(
    reactions: CourseChatMessageReactionSummaryRow[],
  ): CourseChatMessageReactionResponse[] {
    return reactions.map(({ reaction, count, reactedByCurrentUser }) => ({
      reaction,
      count,
      reactedByCurrentUser,
    }));
  }

  private normalizeContent(content: string) {
    const normalized = content.trim();

    if (!normalized) {
      throw new BadRequestException("courseChat.errors.emptyMessage");
    }

    return normalized;
  }

  private isAllowedReaction(reaction: string) {
    return (COURSE_CHAT_ALLOWED_REACTIONS as readonly string[]).includes(reaction);
  }

  private async publishMessageCreatedEvent(
    params: {
      courseId: UUIDType;
      actorUserId: UUIDType;
      messageId: UUIDType;
      parentMessageId?: UUIDType;
    },
    dbInstance?: DatabasePg,
  ) {
    if (params.parentMessageId) {
      await this.outboxPublisher.publish(
        new CourseChatReplyCreatedEvent({
          courseId: params.courseId,
          actorUserId: params.actorUserId,
          messageId: params.messageId,
          parentMessageId: params.parentMessageId,
        }),
        dbInstance,
      );
      return;
    }

    await this.outboxPublisher.publish(
      new CourseChatMessageCreatedEvent({
        courseId: params.courseId,
        actorUserId: params.actorUserId,
        messageId: params.messageId,
      }),
      dbInstance,
    );
  }

  private async getMentionedEnrolledUserIds(params: {
    courseId: UUIDType;
    actorUserId: UUIDType;
    mentionedUserIds?: UUIDType[];
  }) {
    const uniqueMentionedUserIds = Array.from(new Set(params.mentionedUserIds ?? [])).filter(
      (mentionedUserId) => mentionedUserId !== params.actorUserId,
    );

    if (!uniqueMentionedUserIds.length) return [];

    return this.courseChatRepository.getEnrolledUserIds(params.courseId, uniqueMentionedUserIds);
  }

  private emitMentionRealtimeNotifications(params: {
    courseId: UUIDType;
    message: CourseChatMessageResponse;
    mentionedUserIds: UUIDType[];
  }) {
    if (!params.mentionedUserIds.length) return;

    for (const mentionedUserId of params.mentionedUserIds) {
      this.realtimePublisher.emitToRoom(
        COURSE_CHAT_SOCKET_EVENTS.USER_MENTIONED,
        `user:${mentionedUserId}`,
        {
          courseId: params.courseId,
          message: params.message,
        },
      );
    }
  }

  private async publishMentionEvent(
    params: {
      tenantId: UUIDType;
      courseId: UUIDType;
      actorUserId: UUIDType;
      messageId: UUIDType;
      mentionedUserIds: UUIDType[];
    },
    dbInstance?: DatabasePg,
  ) {
    if (!params.mentionedUserIds.length) return;

    await this.outboxPublisher.publish(
      new CourseChatUserMentionedEvent({
        tenantId: params.tenantId,
        courseId: params.courseId,
        actorUserId: params.actorUserId,
        messageId: params.messageId,
        mentionedUserIds: params.mentionedUserIds,
      }),
      dbInstance,
    );
  }
}
