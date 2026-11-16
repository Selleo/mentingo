import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DISCUSSION_SCOPES,
  FORUM_SOCKET_EVENTS,
  PERMISSIONS,
  getForumRoom,
  getForumTopicRoom,
} from "@repo/shared";

import { BaseResponse, DatabasePg, PaginatedResponse } from "src/common";
import { hasPermission } from "src/common/permissions/permission.utils";
import { CourseChatMessageMapper } from "src/course-chat/course-chat-message.mapper";
import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import { CourseChatService } from "src/course-chat/course-chat.service";
import { ForumReplyCreatedEvent } from "src/events/forum/forum-reply-created.event";
import { ForumTopicCreatedEvent } from "src/events/forum/forum-topic-created.event";
import { ForumUserMentionedEvent } from "src/events/forum/forum-user-mentioned.event";
import { FORUM_TOPIC_EXCERPT_LENGTH } from "src/forum/forum.constants";
import { ForumRepository } from "src/forum/forum.repository";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { SettingsService } from "src/settings/settings.service";
import { REALTIME_PUBLISHER, type RealtimePublisher } from "src/websocket/realtime.publisher";
import { getUserRoomName } from "src/websocket/websocket.rooms";

import type { PermissionKey, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { ToggleCourseChatMessageReactionBody } from "src/course-chat/schemas/course-chat.schema";
import type {
  ForumPostContext,
  ForumPostRow,
  ForumThreadContext,
  ForumTopicRow,
} from "src/forum/forum.repository.types";
import type { ForumPostDeletion, ForumTopicListQuery, ForumViewer } from "src/forum/forum.types";
import type {
  CreateForumPostBody,
  CreateForumTopicBody,
  DeleteForumPostResponse,
  ForumPostReactionsResponse,
  ForumPostResponse,
  ForumTopicListItemResponse,
  ForumTopicResponse,
  ForumUserResponse,
} from "src/forum/schemas/forum.schema";

@Injectable()
export class ForumService {
  constructor(
    private readonly forumRepository: ForumRepository,
    private readonly courseChatService: CourseChatService,
    private readonly courseChatRepository: CourseChatRepository,
    private readonly courseChatMessageMapper: CourseChatMessageMapper,
    private readonly settingsService: SettingsService,
    private readonly outboxPublisher: OutboxPublisher,
    @Inject("DB") private readonly db: DatabasePg,
    @Inject(REALTIME_PUBLISHER) private readonly realtimePublisher: RealtimePublisher,
  ) {}

  async getTopics(
    query: ForumTopicListQuery,
    currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<ForumTopicListItemResponse[]>> {
    const search = query.search?.trim();
    const { data, totalItems } = await this.forumRepository.findTopics(
      { ...query, search: search || undefined },
      {
        viewerUserId: currentUser.userId,
        includeCourseThreads: await this.canReadCourseThreads(currentUser),
      },
    );
    const avatarUrlByReference = await this.courseChatMessageMapper.getAvatarUrlByReference(
      data.map((topic) => topic.authorAvatarReference),
    );

    return new PaginatedResponse({
      data: data.map((topic) => ({
        ...this.mapTopicBase(
          topic,
          this.courseChatMessageMapper.getMappedAvatarReference(
            topic.authorAvatarReference,
            avatarUrlByReference,
          ),
        ),
        excerpt: topic.firstPostDeletedAt ? "" : this.toExcerpt(topic.firstPostContent),
        isDeleted: Boolean(topic.firstPostDeletedAt),
      })),
      pagination: { totalItems, page: query.page, perPage: query.perPage },
    });
  }

  async getTopic(
    topicId: UUIDType,
    currentUser: CurrentUserType,
    language: SupportedLanguages,
  ): Promise<BaseResponse<ForumTopicResponse>> {
    await this.getAccessibleThread(topicId, currentUser);

    return new BaseResponse(await this.getTopicResponse(topicId, currentUser.userId, language));
  }

  async getTopicPosts(params: {
    topicId: UUIDType;
    currentUser: CurrentUserType;
    page: number;
    perPage: number;
  }): Promise<PaginatedResponse<ForumPostResponse[]>> {
    const thread = await this.getAccessibleThread(params.topicId, params.currentUser);
    const { data, totalItems } = await this.forumRepository.findReplies(
      thread.firstPostId,
      params.page,
      params.perPage,
    );

    return new PaginatedResponse({
      data: await this.mapPosts(data, params.currentUser.userId),
      pagination: { totalItems, page: params.page, perPage: params.perPage },
    });
  }

  async createTopic(params: {
    body: CreateForumTopicBody;
    currentUser: CurrentUserType;
    language: SupportedLanguages;
  }): Promise<BaseResponse<ForumTopicResponse>> {
    const { body, currentUser, language } = params;
    const title = this.normalizeText(body.title, "forum.errors.emptyTitle");
    const content = this.normalizeText(body.content, "forum.errors.emptyContent");
    const mentionedUserIds = await this.getMentionableUserIds(body.mentionedUserIds, currentUser);

    const { topicId, postId } = await this.db.transaction(async (trx) => {
      const createdTopic = await this.forumRepository.createGeneralTopic(
        { userId: currentUser.userId, title, content },
        trx,
      );

      await this.outboxPublisher.publish(
        new ForumTopicCreatedEvent({ ...createdTopic, actorUserId: currentUser.userId }),
        trx,
      );
      await this.publishMentionEvent({ ...createdTopic, currentUser, mentionedUserIds }, trx);

      return createdTopic;
    });

    this.emitForumChanged(currentUser.tenantId);
    this.emitMentions({ topicId, postId, mentionedUserIds });

    return new BaseResponse(await this.getTopicResponse(topicId, currentUser.userId, language));
  }

  async createPost(params: {
    topicId: UUIDType;
    body: CreateForumPostBody;
    currentUser: CurrentUserType;
    tenantId: UUIDType;
  }): Promise<BaseResponse<ForumPostResponse>> {
    const { topicId, body, currentUser, tenantId } = params;
    const thread = await this.getAccessibleThread(topicId, currentUser);
    const content = this.normalizeText(body.content, "forum.errors.emptyContent");

    if (thread.firstPostDeletedAt) {
      throw new BadRequestException("forum.errors.topicDeleted");
    }

    if (thread.scope === DISCUSSION_SCOPES.COURSE && thread.courseId) {
      this.assertHasPermission(currentUser, PERMISSIONS.COURSE_DISCUSSION_MESSAGE_CREATE);

      const { data: message } = await this.courseChatService.createMessage(
        thread.courseId,
        currentUser,
        tenantId,
        {
          content,
          parentMessageId: thread.firstPostId,
          mentionedUserIds: body.mentionedUserIds,
        },
      );

      return new BaseResponse(await this.getPostResponse(message.id, currentUser.userId));
    }

    const mentionedUserIds = await this.getMentionableUserIds(body.mentionedUserIds, currentUser);

    const postId = await this.db.transaction(async (trx) => {
      const isFirstPostVisible = await this.courseChatRepository.lockThreadForReply(
        thread.id,
        thread.firstPostId,
        trx,
      );

      if (!isFirstPostVisible) throw new BadRequestException("forum.errors.topicDeleted");

      const createdPostId = await this.forumRepository.createGeneralReply(
        {
          threadId: thread.id,
          firstPostId: thread.firstPostId,
          userId: currentUser.userId,
          content,
        },
        trx,
      );

      await this.outboxPublisher.publish(
        new ForumReplyCreatedEvent({
          topicId: thread.id,
          postId: createdPostId,
          firstPostId: thread.firstPostId,
          actorUserId: currentUser.userId,
        }),
        trx,
      );
      await this.publishMentionEvent(
        { topicId: thread.id, postId: createdPostId, currentUser, mentionedUserIds },
        trx,
      );

      return createdPostId;
    });

    this.emitTopicChanged(thread.id);
    this.emitForumChanged(tenantId);
    this.emitMentions({ topicId: thread.id, postId, mentionedUserIds });

    return new BaseResponse(await this.getPostResponse(postId, currentUser.userId));
  }

  async togglePostReaction(
    postId: UUIDType,
    body: ToggleCourseChatMessageReactionBody,
    currentUser: CurrentUserType,
  ): Promise<BaseResponse<ForumPostReactionsResponse>> {
    const post = await this.forumRepository.findPostContext(postId);

    if (!post || post.deletedAt) throw new NotFoundException("forum.errors.postNotFound");

    const thread = await this.getAccessibleThread(post.threadId, currentUser);

    if (thread.scope === DISCUSSION_SCOPES.COURSE) {
      this.assertHasPermission(currentUser, PERMISSIONS.COURSE_DISCUSSION_MESSAGE_REACT);

      const { data } = await this.courseChatService.toggleMessageReaction(
        post.id,
        currentUser.userId,
        body,
      );

      return new BaseResponse({ topicId: thread.id, postId: post.id, reactions: data.reactions });
    }

    if (!this.courseChatService.isAllowedReaction(body.reaction)) {
      throw new BadRequestException("forum.errors.invalidReaction");
    }

    await this.courseChatRepository.toggleMessageReaction({
      messageId: post.id,
      courseId: null,
      userId: currentUser.userId,
      reaction: body.reaction,
    });

    const reactions = this.courseChatMessageMapper.mapReactions(
      await this.courseChatRepository.getMessageReactions(post.id, currentUser.userId),
    );

    this.emitTopicChanged(thread.id);

    return new BaseResponse({ topicId: thread.id, postId: post.id, reactions });
  }

  async getMentionableUsers(): Promise<BaseResponse<ForumUserResponse[]>> {
    const users = await this.forumRepository.findMentionableUsers();
    const avatarUrlByReference = await this.courseChatMessageMapper.getAvatarUrlByReference(
      users.map((user) => user.avatarReference),
    );

    return new BaseResponse(
      users.map((user) => ({
        ...user,
        avatarReference: this.courseChatMessageMapper.getMappedAvatarReference(
          user.avatarReference,
          avatarUrlByReference,
        ),
      })),
    );
  }

  async assertTopicAccessible(topicId: UUIDType, viewer: ForumViewer) {
    await this.getAccessibleThread(topicId, viewer);
  }

  async deletePost(
    postId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<BaseResponse<DeleteForumPostResponse>> {
    const post = await this.forumRepository.findPostContext(postId);

    if (!post || post.deletedAt) throw new NotFoundException("forum.errors.postNotFound");

    const thread = await this.getAccessibleThread(post.threadId, currentUser);
    const deletion =
      thread.scope === DISCUSSION_SCOPES.COURSE
        ? await this.deleteCoursePost(post, currentUser)
        : await this.deleteGeneralPost(post, currentUser);

    this.emitTopicChanged(thread.id);
    this.emitForumChanged(currentUser.tenantId);

    return new BaseResponse({
      topicId: thread.id,
      postId: post.id,
      isFirstPost: post.parentMessageId === null,
      ...deletion,
    });
  }

  private async deleteCoursePost(
    post: ForumPostContext,
    currentUser: CurrentUserType,
  ): Promise<ForumPostDeletion> {
    const { payload, threadRemoved } = await this.courseChatService.deleteCourseMessage(
      post.id,
      currentUser.userId,
      currentUser.permissions ?? [],
    );

    return { removed: payload.removed, deletedAt: payload.deletedAt, topicRemoved: threadRemoved };
  }

  private async deleteGeneralPost(
    post: ForumPostContext,
    currentUser: CurrentUserType,
  ): Promise<ForumPostDeletion> {
    const canDeleteAnyPost = hasPermission(
      currentUser.permissions ?? [],
      PERMISSIONS.FORUM_POST_DELETE,
    );

    if (post.userId !== currentUser.userId && !canDeleteAnyPost) {
      throw new ForbiddenException("forum.errors.cannotDeletePost");
    }

    const deletion = await this.courseChatRepository.deleteMessage(post);

    if (!deletion) throw new NotFoundException("forum.errors.postNotFound");

    return {
      removed: deletion.removed,
      deletedAt: deletion.deletedAt,
      topicRemoved: deletion.threadRemoved,
    };
  }

  /** Inaccessible topics are reported as missing so their existence is not revealed. */
  private async getAccessibleThread(
    threadId: UUIDType,
    currentUser: ForumViewer,
  ): Promise<ForumThreadContext> {
    const thread = await this.forumRepository.findThreadContext(threadId);

    if (!thread || (thread.firstPostDeletedAt && thread.replyCount === 0)) {
      throw new NotFoundException("forum.errors.topicNotFound");
    }

    if (thread.scope === DISCUSSION_SCOPES.GENERAL) return thread;

    const { courseId } = thread;

    if (!courseId || !(await this.canReadCourseThreads(currentUser))) {
      throw new NotFoundException("forum.errors.topicNotFound");
    }

    const isEnrolled = await this.courseChatRepository.isUserEnrolledInCourse(
      courseId,
      currentUser.userId,
    );

    if (!isEnrolled) throw new NotFoundException("forum.errors.topicNotFound");

    return thread;
  }

  private async canReadCourseThreads(currentUser: ForumViewer) {
    if (!hasPermission(currentUser.permissions ?? [], PERMISSIONS.COURSE_DISCUSSION_READ)) {
      return false;
    }

    const globalSettings = await this.settingsService.getGlobalSettings();

    return globalSettings.courseDiscussionsEnabled === true;
  }

  private async getMentionableUserIds(
    mentionedUserIds: UUIDType[] | undefined,
    currentUser: CurrentUserType,
  ): Promise<UUIDType[]> {
    const requestedUserIds = Array.from(new Set(mentionedUserIds ?? [])).filter(
      (mentionedUserId) => mentionedUserId !== currentUser.userId,
    );
    const mentionableUsers = await this.forumRepository.findMentionableUsers(requestedUserIds);

    return mentionableUsers.map((user) => user.id);
  }

  private async publishMentionEvent(
    params: {
      topicId: UUIDType;
      postId: UUIDType;
      currentUser: CurrentUserType;
      mentionedUserIds: UUIDType[];
    },
    dbInstance: DatabasePg,
  ) {
    if (!params.mentionedUserIds.length) return;

    await this.outboxPublisher.publish(
      new ForumUserMentionedEvent({
        tenantId: params.currentUser.tenantId,
        topicId: params.topicId,
        postId: params.postId,
        actorUserId: params.currentUser.userId,
        mentionedUserIds: params.mentionedUserIds,
      }),
      dbInstance,
    );
  }

  private emitMentions(params: {
    topicId: UUIDType;
    postId: UUIDType;
    mentionedUserIds: UUIDType[];
  }) {
    for (const mentionedUserId of params.mentionedUserIds) {
      this.realtimePublisher.emitToRoom(
        FORUM_SOCKET_EVENTS.USER_MENTIONED,
        getUserRoomName(mentionedUserId),
        { topicId: params.topicId, postId: params.postId },
      );
    }
  }

  private emitForumChanged(tenantId: UUIDType) {
    this.realtimePublisher.emitToRoom(FORUM_SOCKET_EVENTS.CHANGED, getForumRoom(tenantId), {});
  }

  private emitTopicChanged(topicId: UUIDType) {
    this.realtimePublisher.emitToRoom(
      FORUM_SOCKET_EVENTS.TOPIC_CHANGED,
      getForumTopicRoom(topicId),
      { topicId },
    );
  }

  private assertHasPermission(currentUser: CurrentUserType, permission: PermissionKey) {
    if (!hasPermission(currentUser.permissions ?? [], permission)) {
      throw new ForbiddenException("auth.error.missingPermission");
    }
  }

  private async getTopicResponse(
    topicId: UUIDType,
    viewerUserId: UUIDType,
    language: SupportedLanguages,
  ): Promise<ForumTopicResponse> {
    const topic = await this.forumRepository.findTopicById(topicId, language);

    if (!topic) throw new NotFoundException("forum.errors.topicNotFound");

    const [firstPost] = await this.mapPosts([this.toFirstPostRow(topic)], viewerUserId);

    return { ...this.mapTopicBase(topic, firstPost.user.avatarReference), firstPost };
  }

  private async getPostResponse(postId: UUIDType, viewerUserId: UUIDType) {
    const post = await this.forumRepository.findPostById(postId);

    if (!post) throw new NotFoundException("forum.errors.postNotFound");

    const [mappedPost] = await this.mapPosts([post], viewerUserId);

    return mappedPost;
  }

  private async mapPosts(posts: ForumPostRow[], viewerUserId: UUIDType) {
    const [reactionsByMessageId, avatarUrlByReference] = await Promise.all([
      this.courseChatMessageMapper.getReactionsByMessageId(
        posts.map((post) => post.id),
        viewerUserId,
      ),
      this.courseChatMessageMapper.getAvatarUrlByReference(
        posts.map((post) => post.authorAvatarReference),
      ),
    ]);

    return posts.map(
      (post): ForumPostResponse => ({
        id: post.id,
        topicId: post.threadId,
        userId: post.userId,
        content: post.deletedAt ? "" : post.content,
        isFirstPost: post.parentMessageId === null,
        deletedAt: post.deletedAt,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        user: {
          id: post.userId,
          firstName: post.authorFirstName,
          lastName: post.authorLastName,
          avatarReference: this.courseChatMessageMapper.getMappedAvatarReference(
            post.authorAvatarReference,
            avatarUrlByReference,
          ),
        },
        reactions: post.deletedAt ? [] : (reactionsByMessageId.get(post.id) ?? []),
      }),
    );
  }

  private mapTopicBase(topic: ForumTopicRow, authorAvatarUrl: string | null) {
    return {
      id: topic.id,
      scope: topic.scope,
      title: topic.title,
      course: topic.courseId ? { id: topic.courseId, title: topic.courseTitle } : null,
      author: {
        id: topic.firstPostUserId,
        firstName: topic.authorFirstName,
        lastName: topic.authorLastName,
        avatarReference: authorAvatarUrl,
      },
      replyCount: topic.replyCount,
      lastActivityAt: topic.lastActivityAt,
      createdAt: topic.createdAt,
    };
  }

  private toFirstPostRow(topic: ForumTopicRow): ForumPostRow {
    return {
      id: topic.firstPostId,
      threadId: topic.id,
      userId: topic.firstPostUserId,
      content: topic.firstPostContent,
      parentMessageId: null,
      deletedAt: topic.firstPostDeletedAt,
      createdAt: topic.firstPostCreatedAt,
      updatedAt: topic.firstPostUpdatedAt,
      authorFirstName: topic.authorFirstName,
      authorLastName: topic.authorLastName,
      authorAvatarReference: topic.authorAvatarReference,
    };
  }

  /** Cuts by code points so surrogate pairs are never split; multi-code-point emoji still can be. */
  private toExcerpt(content: string) {
    return Array.from(content).slice(0, FORUM_TOPIC_EXCERPT_LENGTH).join("");
  }

  private normalizeText(value: string, errorKey: string) {
    const normalized = value.trim();

    if (!normalized) throw new BadRequestException(errorKey);

    return normalized;
  }
}
