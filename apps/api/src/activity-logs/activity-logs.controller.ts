import { Controller, Get, Query } from "@nestjs/common";
import {
  PERMISSIONS,
  type ActivityLogActionType,
  type ActivityLogResourceType,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";
import { match } from "ts-pattern";

import { PaginatedResponse, paginatedResponse } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";

import {
  activityLogActionTypeSchema,
  activityLogResourceTypeSchema,
  activityLogsListSchema,
} from "./activity-logs.schema";
import { ActivityLogsService } from "./activity-logs.service";

import type { ActivityLogsListResponse } from "./activity-logs.types";

@Controller("activity-logs")
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ACTIVITY_LOG_READ)
  @Validate({
    request: [
      { type: "query", name: "page", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      { type: "query", name: "perPage", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      { type: "query", name: "keyword", schema: Type.Optional(Type.String()) },
      { type: "query", name: "email", schema: Type.Optional(Type.String()) },
      {
        type: "query",
        name: "actionTypes",
        schema: Type.Optional(
          Type.Union([activityLogActionTypeSchema, Type.Array(activityLogActionTypeSchema)]),
        ),
      },
      { type: "query", name: "resourceType", schema: Type.Optional(activityLogResourceTypeSchema) },
      { type: "query", name: "from", schema: Type.Optional(Type.String()) },
      { type: "query", name: "to", schema: Type.Optional(Type.String()) },
    ],
    response: paginatedResponse(activityLogsListSchema),
  })
  async getActivityLogs(
    @Query("page") page?: number,
    @Query("perPage") perPage?: number,
    @Query("keyword") keyword?: string,
    @Query("email") email?: string,
    @Query("actionTypes") actionTypes?: ActivityLogActionType | ActivityLogActionType[],
    @Query("resourceType") resourceType?: ActivityLogResourceType,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<PaginatedResponse<ActivityLogsListResponse>> {
    const normalizedActionTypes = match<
      ActivityLogActionType | ActivityLogActionType[] | undefined,
      ActivityLogActionType[]
    >(actionTypes)
      .when(Array.isArray, (values) => values)
      .with(undefined, () => [])
      .otherwise((value) => [value]);

    const logs = await this.activityLogsService.getActivityLogs({
      page,
      perPage,
      keyword,
      email,
      actionTypes: normalizedActionTypes,
      resourceType,
      from,
      to,
    });

    return new PaginatedResponse(logs);
  }
}
