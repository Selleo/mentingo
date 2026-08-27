import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AUDIT_TYPES, PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, UUIDSchema, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import {
  auditBenchmarkSchema,
  auditSubmissionHistorySchema,
  auditSubmissionResultSchema,
  createAuditSubmissionSchema,
  nullableAuditSubmissionResultSchema,
} from "./audit.schema";
import { AuditService } from "./audit.service";
import { CreateAuditSubmissionBody } from "./audit.types";
import { SchoolTenantGuard } from "./school-tenant.guard";

@Controller("audits")
@UseGuards(PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get("individual/latest")
  @RequirePermission(PERMISSIONS.STATISTICS_READ_SELF)
  @Validate({ response: baseResponse(nullableAuditSubmissionResultSchema) })
  async getLatestIndividual(@CurrentUser() currentUser: CurrentUserType) {
    return new BaseResponse(await this.auditService.getLatest(AUDIT_TYPES.INDIVIDUAL, currentUser));
  }

  @Post("individual/submissions")
  @RequirePermission(PERMISSIONS.STATISTICS_READ_SELF)
  @Validate({
    request: [{ type: "body", schema: createAuditSubmissionSchema }],
    response: baseResponse(auditSubmissionResultSchema),
  })
  async submitIndividual(
    @Body() body: CreateAuditSubmissionBody,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return new BaseResponse(
      await this.auditService.submit(AUDIT_TYPES.INDIVIDUAL, body, currentUser),
    );
  }

  @Get("individual/submissions")
  @RequirePermission(PERMISSIONS.STATISTICS_READ_SELF)
  @Validate({ response: baseResponse(auditSubmissionHistorySchema) })
  async getIndividualHistory(@CurrentUser() currentUser: CurrentUserType) {
    return new BaseResponse(
      await this.auditService.getHistory(AUDIT_TYPES.INDIVIDUAL, currentUser),
    );
  }

  @Get("individual/submissions/:id")
  @RequirePermission(PERMISSIONS.STATISTICS_READ_SELF)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(auditSubmissionResultSchema),
  })
  async getIndividualSubmission(
    @Param("id") id: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return new BaseResponse(
      await this.auditService.getSubmission(AUDIT_TYPES.INDIVIDUAL, id, currentUser),
    );
  }

  @Get("school/latest")
  @UseGuards(SchoolTenantGuard)
  @RequirePermission(PERMISSIONS.STATISTICS_READ)
  @Validate({ response: baseResponse(nullableAuditSubmissionResultSchema) })
  async getLatestSchool(@CurrentUser() currentUser: CurrentUserType) {
    return new BaseResponse(await this.auditService.getLatest(AUDIT_TYPES.SCHOOL, currentUser));
  }

  @Post("school/submissions")
  @UseGuards(SchoolTenantGuard)
  @RequirePermission(PERMISSIONS.STATISTICS_READ)
  @Validate({
    request: [{ type: "body", schema: createAuditSubmissionSchema }],
    response: baseResponse(auditSubmissionResultSchema),
  })
  async submitSchool(
    @Body() body: CreateAuditSubmissionBody,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return new BaseResponse(await this.auditService.submit(AUDIT_TYPES.SCHOOL, body, currentUser));
  }

  @Get("school/submissions")
  @UseGuards(SchoolTenantGuard)
  @RequirePermission(PERMISSIONS.STATISTICS_READ)
  @Validate({ response: baseResponse(auditSubmissionHistorySchema) })
  async getSchoolHistory(@CurrentUser() currentUser: CurrentUserType) {
    return new BaseResponse(await this.auditService.getHistory(AUDIT_TYPES.SCHOOL, currentUser));
  }

  @Get("school/submissions/:id")
  @UseGuards(SchoolTenantGuard)
  @RequirePermission(PERMISSIONS.STATISTICS_READ)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(auditSubmissionResultSchema),
  })
  async getSchoolSubmission(
    @Param("id") id: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return new BaseResponse(
      await this.auditService.getSubmission(AUDIT_TYPES.SCHOOL, id, currentUser),
    );
  }

  @Get("benchmark")
  @UseGuards(SchoolTenantGuard)
  @RequirePermission(PERMISSIONS.STATISTICS_READ)
  @Validate({ response: baseResponse(auditBenchmarkSchema) })
  async getBenchmark(@CurrentUser() currentUser: CurrentUserType) {
    return new BaseResponse(await this.auditService.getBenchmark(currentUser));
  }
}
