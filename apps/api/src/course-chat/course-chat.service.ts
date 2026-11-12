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

import { AnnouncementsService } from "src/announcements/announcements.service";
import { BaseResponse, PaginatedResponse, DatabasePg } from "src/common";
import { CourseChatMessageMapper } from "src/course-chat/course-chat-message.mapper";
import { CourseChatPresenceService } from "src/course-chat/course-chat-presence.service";
import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import { CourseChatMessageCreatedEvent } from "src/events/course-chat/course-chat-message-created.event";
import { CourseChatReplyCreatedEvent } from "src/events/course-chat/course-chat-reply-created.event";
import { CourseChatUserMentionedEvent } from "src/events/course-chat/course-chat-user-mentioned.event";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { REALTIME_PUBLISHER } from "src/websocket/realtime.publisher";

import type { PermissionKey } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
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
    private readonly announcementService: AnnouncementsService,
    @Inject("DB") private readonly db: DatabasePg,
    @Inject(REALTIME_PUBLISHER) private readonly realtimePublisher: CourseChatRealtimePublisher,
    private readonly courseChatMessageMapper: CourseChatMessageMapper,
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
      data: await this.courseChatMessageMapper.mapMessages(messages.data, params.userId, {
        includeReplySummary: true,
      }),
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
      data: await this.courseChatMessageMapper.mapMessages(replies.data, params.userId, {
        includeReplySummary: false,
      }),
    });
  }

  async getUsers(
    courseId: UUIDType,
    userId: UUIDType,
  ): Promise<BaseResponse<CourseChatUserResponse[]>> {
    await this.assertUserEnrolledInCourse(courseId, userId);

    const users = await this.courseChatRepository.getEnrolledUsers(courseId);
    const avatarUrlByReference = await this.courseChatMessageMapper.getAvatarUrlByReference(
      users.map((user) => user.avatarReference),
    );
    const onlineUserIds = await this.courseChatPresenceService.getOnlineUserIds(
      courseId,
      users.map((user) => user.id),
    );

    return new BaseResponse(
      users.map((user) => ({
        ...user,
        avatarReference: this.courseChatMessageMapper.getMappedAvatarReference(
          user.avatarReference,
          avatarUrlByReference,
        ),
        isOnline: onlineUserIds.has(user.id),
      })),
    );
  }

  async createMessage(
    courseId: UUIDType,
    currentUser: CurrentUserType,
    tenantId: UUIDType,
    body: CreateCourseChatMessageBody,
  ): Promise<BaseResponse<CourseChatMessageResponse>> {
    await this.assertUserEnrolledInCourse(courseId, currentUser.userId);

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
      actorUserId: currentUser.userId,
      mentionedUserIds: body.mentionedUserIds,
    });

    const messageId = await this.db.transaction(async (trx) => {
      const createdMessageId = await this.courseChatRepository.createMessage({
        courseId,
        userId: currentUser.userId,
        content: this.normalizeContent(body.content),
        parentMessageId: body.parentMessageId,
        parentMessage: parentMessage ?? undefined,
        dbInstance: trx,
      });

      await this.publishMessageCreatedEvent(
        {
          courseId,
          actorUserId: currentUser.userId,
          messageId: createdMessageId,
          parentMessageId: body.parentMessageId,
        },
        trx,
      );

      await this.publishMentionEvent(
        {
          tenantId,
          courseId,
          currentUser,
          messageId: createdMessageId,
          mentionedUserIds,
        },
        trx,
      );

      return createdMessageId;
    });

    const message = await this.getMessageResponse(messageId, currentUser.userId);

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

    const reactions = this.courseChatMessageMapper.mapReactions(
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

    const [mappedMessage] = await this.courseChatMessageMapper.mapMessages(
      [message],
      viewerUserId,
      {
        includeReplySummary: true,
      },
    );

    return mappedMessage;
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
      currentUser: CurrentUserType;
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
        currentUser: params.currentUser,
        messageId: params.messageId,
        mentionedUserIds: params.mentionedUserIds,
      }),
      dbInstance,
    );
  }
}
