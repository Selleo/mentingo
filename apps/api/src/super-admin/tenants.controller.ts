import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, PaginatedResponse, paginatedResponse } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { ManagingTenantAdminGuard } from "src/common/guards/managing-tenant-admin.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { USER_ROLES } from "src/user/schemas/userRoles";

import {
  createTenantSchema,
  tenantResponseSchema,
  tenantsListSchema,
  updateTenantSchema,
} from "./schemas/tenant.schema";
import { TenantsService } from "./tenants.service";
import { CreateTenantBody, UpdateTenantBody } from "./types";

import type { TenantResponse, TenantsListResponse } from "./types";

@Controller("super-admin/tenants")
@UseGuards(RolesGuard, ManagingTenantAdminGuard)
@Roles(USER_ROLES.ADMIN)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @Validate({
    request: [
      { type: "query", name: "page", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      { type: "query", name: "perPage", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      { type: "query", name: "search", schema: Type.Optional(Type.String()) },
    ],
    response: paginatedResponse(tenantsListSchema),
  })
  async findAllTenants(
    @Query("page") page?: number,
    @Query("perPage") perPage?: number,
    @Query("search") search?: string,
  ): Promise<PaginatedResponse<TenantsListResponse>> {
    const result = await this.tenantsService.findAllTenants({ page, perPage, search });
    return new PaginatedResponse(result);
  }

  @Get(":id")
  @Validate({
    request: [{ type: "param", name: "id", schema: Type.String({ format: "uuid" }) }],
    response: baseResponse(tenantResponseSchema),
  })
  async findTenantById(@Param("id") id: string): Promise<BaseResponse<TenantResponse>> {
    const tenant = await this.tenantsService.findTenantById(id);
    return new BaseResponse(tenant);
  }

  @Post()
  @Validate({
    request: [{ type: "body", schema: createTenantSchema }],
    response: baseResponse(tenantResponseSchema),
  })
  async createTenant(
    @Body() body: CreateTenantBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<TenantResponse>> {
    const tenant = await this.tenantsService.createTenant(body, currentUser);
    return new BaseResponse(tenant);
  }

  @Patch(":id")
  @Validate({
    request: [
      { type: "param", name: "id", schema: Type.String({ format: "uuid" }) },
      { type: "body", schema: updateTenantSchema },
    ],
    response: baseResponse(tenantResponseSchema),
  })
  async updateTenantById(
    @Param("id") id: string,
    @Body() body: UpdateTenantBody,
  ): Promise<BaseResponse<TenantResponse>> {
    const tenant = await this.tenantsService.updateTenantById(id, body);
    return new BaseResponse(tenant);
  }
}
