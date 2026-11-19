import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import {
  FEATURES,
  FORUM_TOPIC_SORTS,
  PERMISSIONS,
  type ForumTopicSort,
  type SupportedLanguages,
} from "@repo/shared";
import { Validate } from "nestjs-typebox";

import {
  baseResponse,
  paginatedResponse,
  UUIDSchema,
  type BaseResponse,
  type PaginatedResponse,
  type UUIDType,
} from "src/common";
import { RequireFeature } from "src/common/decorators/require-feature.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { CurrentUserType } from "src/common/types/current-user.type";
import {
  toggleCourseChatMessageReactionSchema,
  type ToggleCourseChatMessageReactionBody,
} from "src/course-chat/schemas/course-chat.schema";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { ForumService } from "src/forum/forum.service";
import {
  createForumPostSchema,
  createForumTopicSchema,
  deleteForumPostResponseSchema,
  forumCourseDiscussionListSchema,
  forumCourseDiscussionSchema,
  forumPageQuerySchema,
  forumPerPageQuerySchema,
  forumPostListSchema,
  forumPostReactionsSchema,
  forumPostSchema,
  forumSearchQuerySchema,
  forumTopicListSchema,
  forumTopicFollowingSchema,
  forumTopicSchema,
  forumTopicSortQuerySchema,
  forumUserListSchema,
  type CreateForumPostBody,
  type CreateForumTopicBody,
  type DeleteForumPostResponse,
  type ForumCourseDiscussionResponse,
  type ForumPostReactionsResponse,
  type ForumPostResponse,
  type ForumTopicListItemResponse,
  type ForumTopicFollowingResponse,
  type ForumTopicResponse,
  type ForumUserResponse,
} from "src/forum/schemas/forum.schema";

@Controller("forum")
@RequireFeature({ features: [FEATURES.FORUM] })
@RequirePermission(PERMISSIONS.FORUM_READ)
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Get("topics")
  @Validate({
    request: [
      { type: "query", name: "page", schema: forumPageQuerySchema },
      { type: "query", name: "perPage", schema: forumPerPageQuerySchema },
      { type: "query", name: "sort", schema: forumTopicSortQuerySchema },
      { type: "query", name: "search", schema: forumSearchQuerySchema },
    ],
    response: paginatedResponse(forumTopicListSchema),
  })
  async getTopics(
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @Query("sort") sort: ForumTopicSort | undefined,
    @Query("search") search: string | undefined,
  ): Promise<PaginatedResponse<ForumTopicListItemResponse[]>> {
    return this.forumService.getTopics({
      page: page ?? 1,
      perPage: perPage ?? DEFAULT_PAGE_SIZE,
      sort: sort ?? FORUM_TOPIC_SORTS.LAST_ACTIVITY,
      search,
    });
  }

  @Get("course-discussions")
  @Validate({
    request: [
      { type: "query", name: "page", schema: forumPageQuerySchema },
      { type: "query", name: "perPage", schema: forumPerPageQuerySchema },
      { type: "query", name: "search", schema: forumSearchQuerySchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: paginatedResponse(forumCourseDiscussionListSchema),
  })
  async getCourseDiscussions(
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @Query("search") search: string | undefined,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<ForumCourseDiscussionResponse[]>> {
    return this.forumService.getCourseDiscussions(
      { page: page ?? 1, perPage: perPage ?? DEFAULT_PAGE_SIZE, search, language },
      currentUser,
    );
  }

  @Get("course-discussions/:courseId")
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(forumCourseDiscussionSchema),
  })
  async getCourseDiscussion(
    @Param("courseId") courseId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ForumCourseDiscussionResponse>> {
    return this.forumService.getCourseDiscussion(courseId, currentUser, language);
  }

  @Post("topics")
  @RequirePermission(PERMISSIONS.FORUM_TOPIC_CREATE)
  @Validate({
    request: [{ type: "body", schema: createForumTopicSchema }],
    response: baseResponse(forumTopicSchema),
  })
  async createTopic(
    @Body() body: CreateForumTopicBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ForumTopicResponse>> {
    return this.forumService.createTopic({ body, currentUser });
  }

  @Get("topics/:topicId")
  @Validate({
    request: [{ type: "param", name: "topicId", schema: UUIDSchema }],
    response: baseResponse(forumTopicSchema),
  })
  async getTopic(
    @Param("topicId") topicId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ForumTopicResponse>> {
    return this.forumService.getTopic(topicId, currentUser);
  }

  @Put("topics/:topicId/follow")
  @Validate({
    request: [{ type: "param", name: "topicId", schema: UUIDSchema }],
    response: baseResponse(forumTopicFollowingSchema),
  })
  async followTopic(
    @Param("topicId") topicId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<ForumTopicFollowingResponse>> {
    return this.forumService.setTopicFollowing(topicId, userId, true);
  }

  @Delete("topics/:topicId/follow")
  @Validate({
    request: [{ type: "param", name: "topicId", schema: UUIDSchema }],
    response: baseResponse(forumTopicFollowingSchema),
  })
  async unfollowTopic(
    @Param("topicId") topicId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<ForumTopicFollowingResponse>> {
    return this.forumService.setTopicFollowing(topicId, userId, false);
  }

  /** Replies only; the first post is returned with the topic. */
  @Get("topics/:topicId/posts")
  @Validate({
    request: [
      { type: "param", name: "topicId", schema: UUIDSchema },
      { type: "query", name: "page", schema: forumPageQuerySchema },
      { type: "query", name: "perPage", schema: forumPerPageQuerySchema },
    ],
    response: paginatedResponse(forumPostListSchema),
  })
  async getTopicPosts(
    @Param("topicId") topicId: UUIDType,
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<ForumPostResponse[]>> {
    return this.forumService.getTopicPosts({
      topicId,
      currentUser,
      page: page ?? 1,
      perPage: perPage ?? DEFAULT_PAGE_SIZE,
    });
  }

  @Post("topics/:topicId/posts")
  @RequirePermission(PERMISSIONS.FORUM_POST_CREATE)
  @Validate({
    request: [
      { type: "param", name: "topicId", schema: UUIDSchema },
      { type: "body", schema: createForumPostSchema },
    ],
    response: baseResponse(forumPostSchema),
  })
  async createPost(
    @Param("topicId") topicId: UUIDType,
    @Body() body: CreateForumPostBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ForumPostResponse>> {
    return this.forumService.createPost({ topicId, body, currentUser });
  }

  @Post("posts/:postId/reactions")
  @RequirePermission(PERMISSIONS.FORUM_POST_REACT)
  @Validate({
    request: [
      { type: "param", name: "postId", schema: UUIDSchema },
      { type: "body", schema: toggleCourseChatMessageReactionSchema },
    ],
    response: baseResponse(forumPostReactionsSchema),
  })
  async togglePostReaction(
    @Param("postId") postId: UUIDType,
    @Body() body: ToggleCourseChatMessageReactionBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ForumPostReactionsResponse>> {
    return this.forumService.togglePostReaction(postId, body, currentUser);
  }

  @Get("users")
  @RequirePermission(PERMISSIONS.FORUM_TOPIC_CREATE, PERMISSIONS.FORUM_POST_CREATE)
  @Validate({
    response: baseResponse(forumUserListSchema),
  })
  async getMentionableUsers(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ForumUserResponse[]>> {
    return this.forumService.getMentionableUsers(currentUser);
  }

  @Delete("posts/:postId")
  @Validate({
    request: [{ type: "param", name: "postId", schema: UUIDSchema }],
    response: baseResponse(deleteForumPostResponseSchema),
  })
  async deletePost(
    @Param("postId") postId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<DeleteForumPostResponse>> {
    return this.forumService.deletePost(postId, currentUser);
  }
}
