import { Injectable } from "@nestjs/common";

import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import { FileService } from "src/file/file.service";
import { IMAGE_QUALITY } from "src/file/image-variants/image-variant.constants";

import type { UUIDType } from "src/common";
import type {
  CourseChatMessageReactionSummaryRow,
  CourseChatMessageRow,
  CourseChatReplyParticipantRow,
  CourseChatReplySummaryRow,
} from "src/course-chat/course-chat.repository.types";
import type {
  CourseChatMessagePreviewResponse,
  CourseChatMessageReactionResponse,
  CourseChatMessageResponse,
} from "src/course-chat/schemas/course-chat.schema";

@Injectable()
export class CourseChatMessageMapper {
  constructor(
    private readonly courseChatRepository: CourseChatRepository,
    private readonly fileService: FileService,
  ) {}

  async mapMessages(
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

  async getReactionsByMessageId(messageIds: UUIDType[], viewerUserId: UUIDType) {
    return this.groupReactions(
      await this.courseChatRepository.getMessageReactionsForMessages(messageIds, viewerUserId),
    );
  }

  async getAvatarUrlByReference(avatarReferences: (string | null)[]) {
    const uniqueAvatarReferences = Array.from(
      new Set(avatarReferences.filter((reference): reference is string => Boolean(reference))),
    );

    const avatarEntries = await Promise.all(
      uniqueAvatarReferences.map(
        async (avatarReference): Promise<[string, string]> => [
          avatarReference,
          await this.fileService.getFileUrl(avatarReference, { quality: IMAGE_QUALITY.XXS }),
        ],
      ),
    );

    return new Map(avatarEntries);
  }

  getMappedAvatarReference(
    avatarReference: string | null,
    avatarUrlByReference: Map<string, string>,
  ) {
    if (!avatarReference) return null;
    return avatarUrlByReference.get(avatarReference) ?? avatarReference;
  }

  mapReactions(
    reactions: CourseChatMessageReactionSummaryRow[],
  ): CourseChatMessageReactionResponse[] {
    return reactions.map(({ reaction, count, reactedByCurrentUser }) => ({
      reaction,
      count,
      reactedByCurrentUser,
    }));
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

  private groupReactions(reactions: CourseChatMessageReactionSummaryRow[]) {
    const reactionsByMessageId = new Map<UUIDType, CourseChatMessageReactionResponse[]>();

    for (const reaction of reactions) {
      const current = reactionsByMessageId.get(reaction.messageId) ?? [];
      current.push(...this.mapReactions([reaction]));
      reactionsByMessageId.set(reaction.messageId, current);
    }

    return reactionsByMessageId;
  }
}
