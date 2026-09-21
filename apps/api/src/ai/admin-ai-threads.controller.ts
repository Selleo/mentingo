import { Controller, Get, Param, Query } from "@nestjs/common";
import { PERMISSIONS, SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import {
  adminAiThreadDetailSchema,
  adminAiThreadMessageSchema,
  adminAiThreadPaginationSchema,
  adminAiThreadQuerySchema,
  adminAiThreadSummarySchema,
  type AdminAiThreadDetail,
  type AdminAiThreadMessage,
  type AdminAiThreadQuery,
  type AdminAiThreadSummary,
} from "src/ai/admin-ai-threads.schema";
import { AdminAiThreadsService } from "src/ai/services/admin-ai-threads.service";
import {
  BaseResponse,
  baseResponse,
  PaginatedResponse,
  paginatedResponse,
  UUIDSchema,
  UUIDType,
} from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";

@Controller("admin/ai-threads")
export class AdminAiThreadsController {
  constructor(private readonly adminAiThreadsService: AdminAiThreadsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.AI_THREAD_READ)
  @Validate({
    request: Object.entries(adminAiThreadQuerySchema.properties).map(([name, schema]) => ({
      type: "query" as const,
      name,
      schema,
    })),
    response: paginatedResponse(Type.Array(adminAiThreadSummarySchema)),
  })
  async getAdminAiThreadSummaries(
    @Query("page") pageNumber?: number,
    @Query("perPage") resultsPerPage?: number,
    @Query("userId") ownerUserId?: string,
    @Query("type") threadType?: AdminAiThreadQuery["type"],
    @Query("status") threadStatus?: AdminAiThreadQuery["status"],
    @Query("search") titleSearch?: string,
    @Query("from") startedAtOrAfter?: string,
    @Query("to") startedBefore?: string,
    @Query("language") contentLanguage?: SupportedLanguages,
  ): Promise<PaginatedResponse<AdminAiThreadSummary[]>> {
    return new PaginatedResponse(
      await this.adminAiThreadsService.getThreadSummaries({
        page: pageNumber,
        perPage: resultsPerPage,
        userId: ownerUserId,
        type: threadType,
        status: threadStatus,
        search: titleSearch,
        from: startedAtOrAfter,
        to: startedBefore,
        language: contentLanguage,
      }),
    );
  }

  @Get(":threadId")
  @RequirePermission(PERMISSIONS.AI_THREAD_READ)
  @Validate({
    request: [
      { type: "param", name: "threadId", schema: UUIDSchema },
      { type: "query", name: "language", schema: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)) },
    ],
    response: baseResponse(adminAiThreadDetailSchema),
  })
  async getAdminAiThreadDetails(
    @Param("threadId") threadId: UUIDType,
    @Query("language") language?: SupportedLanguages,
  ): Promise<BaseResponse<AdminAiThreadDetail>> {
    return new BaseResponse(await this.adminAiThreadsService.getThread(threadId, { language }));
  }

  @Get(":threadId/messages")
  @RequirePermission(PERMISSIONS.AI_THREAD_READ)
  @Validate({
    request: [
      { type: "param", name: "threadId", schema: UUIDSchema },
      ...Object.entries(adminAiThreadPaginationSchema.properties).map(([name, schema]) => ({
        type: "query" as const,
        name,
        schema,
      })),
    ],
    response: paginatedResponse(Type.Array(adminAiThreadMessageSchema)),
  })
  async getAdminAiThreadMessages(
    @Param("threadId") threadId: UUIDType,
    @Query("page") pageNumber?: number,
    @Query("perPage") resultsPerPage?: number,
  ): Promise<PaginatedResponse<AdminAiThreadMessage[]>> {
    return new PaginatedResponse(
      await this.adminAiThreadsService.getThreadMessages(threadId, {
        page: pageNumber,
        perPage: resultsPerPage,
      }),
    );
  }
}
