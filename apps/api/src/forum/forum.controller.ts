import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import {
  FEATURES,
  FORUM_TOPIC_SORTS,
  type DiscussionScope,
  type ForumTopicSort,
  type SupportedLanguages,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";
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
import { CurrentUser } from "src/common/decorators/user.decorator";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { ForumService } from "src/forum/forum.service";
import {
  createForumPostSchema,
  createForumTopicSchema,
  deleteForumPostResponseSchema,
  forumPageQuerySchema,
  forumPerPageQuerySchema,
  forumPostListSchema,
  forumPostSchema,
  forumSearchQuerySchema,
  forumTopicListSchema,
  forumTopicSchema,
  forumTopicScopeQuerySchema,
  forumTopicSortQuerySchema,
  type CreateForumPostBody,
  type CreateForumTopicBody,
  type DeleteForumPostResponse,
  type ForumPostResponse,
  type ForumTopicListItemResponse,
  type ForumTopicResponse,
} from "src/forum/schemas/forum.schema";

/** Open to every signed-in user; course threads additionally follow course discussion access. */
@Controller("forum")
@RequireFeature({ features: [FEATURES.FORUM] })
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Get("topics")
  @Validate({
    request: [
      { type: "query", name: "page", schema: forumPageQuerySchema },
      { type: "query", name: "perPage", schema: forumPerPageQuerySchema },
      { type: "query", name: "sort", schema: forumTopicSortQuerySchema },
      { type: "query", name: "search", schema: forumSearchQuerySchema },
      { type: "query", name: "scope", schema: forumTopicScopeQuerySchema },
      { type: "query", name: "courseId", schema: Type.Optional(UUIDSchema) },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: paginatedResponse(forumTopicListSchema),
  })
  async getTopics(
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @Query("sort") sort: ForumTopicSort | undefined,
    @Query("search") search: string | undefined,
    @Query("scope") scope: DiscussionScope | undefined,
    @Query("courseId") courseId: UUIDType | undefined,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<ForumTopicListItemResponse[]>> {
    return this.forumService.getTopics(
      {
        page: page ?? 1,
        perPage: perPage ?? DEFAULT_PAGE_SIZE,
        sort: sort ?? FORUM_TOPIC_SORTS.LAST_ACTIVITY,
        search,
        scope,
        courseId,
        language,
      },
      currentUser,
    );
  }

  @Post("topics")
  @Validate({
    request: [
      { type: "body", schema: createForumTopicSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(forumTopicSchema),
  })
  async createTopic(
    @Body() body: CreateForumTopicBody,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ForumTopicResponse>> {
    return this.forumService.createTopic({ body, currentUser, language });
  }

  @Get("topics/:topicId")
  @Validate({
    request: [
      { type: "param", name: "topicId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(forumTopicSchema),
  })
  async getTopic(
    @Param("topicId") topicId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ForumTopicResponse>> {
    return this.forumService.getTopic(topicId, currentUser, language);
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
    @CurrentUser("tenantId") tenantId: UUIDType,
  ): Promise<BaseResponse<ForumPostResponse>> {
    return this.forumService.createPost({ topicId, body, currentUser, tenantId });
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
