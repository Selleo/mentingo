import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  PERMISSIONS,
  AUTOMATION_RUN_STATUSES,
  type AutomationRunStatus,
  type AutomationRunSummary,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import {
  BaseResponse,
  PaginatedResponse,
  UUIDSchema,
  baseResponse,
  type UUIDType,
} from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { parsePagination } from "src/common/pagination";

import {
  paginatedAutomationRunSchema,
  automationRunDetailSchema,
  type AutomationRunDetailResponse,
} from "./schema/automation.schema";
import { AutomationRunHistoryService } from "./services/automation-run-history.service";

@Controller("automation-runs")
@RequirePermission(PERMISSIONS.AUTOMATION_LOG_READ)
export class AutomationRunHistoryController {
  constructor(private readonly automationRunHistoryService: AutomationRunHistoryService) {}

  @Get()
  @Validate({
    request: [
      { type: "query", name: "page", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      {
        type: "query",
        name: "perPage",
        schema: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
      },
      { type: "query", name: "search", schema: Type.Optional(Type.String({ maxLength: 200 })) },
      { type: "query", name: "automationId", schema: Type.Optional(UUIDSchema) },
      {
        type: "query",
        name: "status",
        schema: Type.Optional(Type.Enum(AUTOMATION_RUN_STATUSES)),
      },
    ],
    response: paginatedAutomationRunSchema,
  })
  async listAutomationRuns(
    @Query("page") page?: number,
    @Query("perPage") perPage?: number,
    @Query("search") search?: string,
    @Query("automationId") automationId?: UUIDType,
    @Query("status") status?: AutomationRunStatus,
  ): Promise<PaginatedResponse<AutomationRunSummary[]>> {
    return new PaginatedResponse(
      await this.automationRunHistoryService.listAutomationRuns({
        ...parsePagination(page, perPage),
        automationId,
        status,
        search,
      }),
    );
  }

  @Get(":id")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(automationRunDetailSchema),
  })
  async getAutomationRun(
    @Param("id") id: UUIDType,
  ): Promise<BaseResponse<AutomationRunDetailResponse>> {
    return new BaseResponse(await this.automationRunHistoryService.getAutomationRun(id));
  }
}
