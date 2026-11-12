import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DISCUSSION_SCOPES, PERMISSIONS } from "@repo/shared";

import { BaseResponse, DatabasePg, PaginatedResponse } from "src/common";
import { hasPermission } from "src/common/permissions/permission.utils";
import { CourseChatMessageMapper } from "src/course-chat/course-chat-message.mapper";
import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import { CourseChatService } from "src/course-chat/course-chat.service";
import { FORUM_TOPIC_EXCERPT_LENGTH } from "src/forum/forum.constants";
import { ForumRepository } from "src/forum/forum.repository";
import { SettingsService } from "src/settings/settings.service";

import type { PermissionKey, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
  ForumPostRow,
  ForumThreadContext,
  ForumTopicRow,
} from "src/forum/forum.repository.types";
import type { ForumTopicListQuery } from "src/forum/forum.types";
import type {
  CreateForumPostBody,
  CreateForumTopicBody,
  DeleteForumPostResponse,
  ForumPostResponse,
  ForumTopicListItemResponse,
  ForumTopicResponse,
} from "src/forum/schemas/forum.schema";

@Injectable()
export class ForumService {
  constructor(
    private readonly forumRepository: ForumRepository,
    private readonly courseChatService: CourseChatService,
    private readonly courseChatRepository: CourseChatRepository,
    private readonly courseChatMessageMapper: CourseChatMessageMapper,
    private readonly settingsService: SettingsService,
    @Inject("DB") private readonly db: DatabasePg,
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

    const topicId = await this.db.transaction((trx) =>
      this.forumRepository.createGeneralTopic({ userId: currentUser.userId, title, content }, trx),
    );

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
        { content, parentMessageId: thread.firstPostId },
      );

      return new BaseResponse(await this.getPostResponse(message.id, currentUser.userId));
    }

    const postId = await this.db.transaction((trx) =>
      this.forumRepository.createGeneralReply(
        {
          threadId: thread.id,
          firstPostId: thread.firstPostId,
          userId: currentUser.userId,
          content,
        },
        trx,
      ),
    );

    return new BaseResponse(await this.getPostResponse(postId, currentUser.userId));
  }

  async deletePost(
    postId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<BaseResponse<DeleteForumPostResponse>> {
    const post = await this.forumRepository.findPostContext(postId);

    if (!post || post.deletedAt) throw new NotFoundException("forum.errors.postNotFound");

    const thread = await this.getAccessibleThread(post.threadId, currentUser);
    const isFirstPost = post.parentMessageId === null;

    if (thread.scope === DISCUSSION_SCOPES.COURSE) {
      const { data } = await this.courseChatService.deleteMessage(
        post.id,
        currentUser.userId,
        currentUser.permissions ?? [],
      );

      return new BaseResponse({
        topicId: thread.id,
        postId: post.id,
        isFirstPost,
        removed: data.removed,
        deletedAt: data.deletedAt,
      });
    }

    const canDeleteAnyPost = hasPermission(
      currentUser.permissions ?? [],
      PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE,
    );

    if (post.userId !== currentUser.userId && !canDeleteAnyPost) {
      throw new ForbiddenException("forum.errors.cannotDeletePost");
    }

    const replyCount = isFirstPost ? await this.courseChatRepository.countReplies(post.id) : 0;
    const deletedAt = await this.courseChatRepository.softDeleteMessage(post.id);

    return new BaseResponse({
      topicId: thread.id,
      postId: post.id,
      isFirstPost,
      removed: !isFirstPost || replyCount === 0,
      deletedAt,
    });
  }

  /** Inaccessible topics are reported as missing so their existence is not revealed. */
  private async getAccessibleThread(
    threadId: UUIDType,
    currentUser: CurrentUserType,
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

  private async canReadCourseThreads(currentUser: CurrentUserType) {
    if (!hasPermission(currentUser.permissions ?? [], PERMISSIONS.COURSE_DISCUSSION_READ)) {
      return false;
    }

    const globalSettings = await this.settingsService.getGlobalSettings();

    return globalSettings.courseDiscussionsEnabled === true;
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
