import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { PERMISSIONS, type DirectorySyncProvider } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, PaginatedResponse, paginatedResponse } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import {
  directoryGroupSchema,
  directoryOrganizationalUnitSchema,
  directorySyncConnectionResponseSchema,
  directorySyncProviderSchema,
  directorySyncRunSchema,
  directorySyncSetupDetailsSchema,
  replaceDirectorySyncGroupMappingsSchema,
  replaceDirectorySyncRoleMappingsSchema,
  upsertDirectorySyncConnectionSchema,
  type DirectoryGroupResponse,
  type DirectoryOrganizationalUnitResponse,
  type DirectorySyncConnectionResponse,
  type DirectorySyncRunResponse,
  type DirectorySyncSetupDetailsResponse,
  type ReplaceDirectorySyncGroupMappingsBody,
  type ReplaceDirectorySyncRoleMappingsBody,
  type UpsertDirectorySyncConnectionBody,
} from "./schemas/directory-sync.schema";
import { DirectorySyncConnectionService } from "./services/directory-sync-connection.service";

const providerParam = {
  type: "param",
  name: "provider",
  schema: directorySyncProviderSchema,
} as const;

@ApiTags("Directory Sync")
@ApiUnauthorizedResponse({ description: "Authentication required." })
@ApiForbiddenResponse({ description: "Directory sync management permission required." })
@Controller("directory-sync/:provider")
@UseGuards(PermissionsGuard)
export class DirectorySyncController {
  constructor(private readonly directorySyncConnectionService: DirectorySyncConnectionService) {}

  @Get("setup")
  @RequirePermission(PERMISSIONS.DIRECTORY_SYNC_MANAGE)
  @ApiOperation({ summary: "Get the client ID and scopes to grant in the customer's directory" })
  @Validate({
    request: [providerParam],
    response: baseResponse(directorySyncSetupDetailsSchema),
  })
  async getDirectorySyncSetupDetails(
    @Param("provider") provider: DirectorySyncProvider,
  ): Promise<BaseResponse<DirectorySyncSetupDetailsResponse>> {
    return new BaseResponse(await this.directorySyncConnectionService.getSetupDetails(provider));
  }

  @Get("connection")
  @RequirePermission(PERMISSIONS.DIRECTORY_SYNC_MANAGE)
  @ApiOperation({ summary: "Get the directory sync connection, or null when not set up" })
  @Validate({
    request: [providerParam],
    response: baseResponse(directorySyncConnectionResponseSchema),
  })
  async getDirectorySyncConnection(
    @Param("provider") provider: DirectorySyncProvider,
  ): Promise<BaseResponse<DirectorySyncConnectionResponse>> {
    return new BaseResponse(await this.directorySyncConnectionService.getConnection(provider));
  }

  @Put("connection")
  @RequirePermission(PERMISSIONS.DIRECTORY_SYNC_MANAGE)
  @ApiOperation({ summary: "Create or update the directory sync connection settings" })
  @Validate({
    request: [providerParam, { type: "body", schema: upsertDirectorySyncConnectionSchema }],
    response: baseResponse(directorySyncConnectionResponseSchema),
  })
  async upsertDirectorySyncConnection(
    @Param("provider") provider: DirectorySyncProvider,
    @Body() connectionSettings: UpsertDirectorySyncConnectionBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<DirectorySyncConnectionResponse>> {
    return new BaseResponse(
      await this.directorySyncConnectionService.upsertConnection(
        provider,
        connectionSettings,
        currentUser,
      ),
    );
  }

  @Post("connection/verification")
  @RequirePermission(PERMISSIONS.DIRECTORY_SYNC_MANAGE)
  @ApiOperation({ summary: "Check that Mentingo can read the customer's directory" })
  @Validate({
    request: [providerParam],
    response: baseResponse(directorySyncConnectionResponseSchema),
  })
  async verifyDirectorySyncConnection(
    @Param("provider") provider: DirectorySyncProvider,
  ): Promise<BaseResponse<DirectorySyncConnectionResponse>> {
    return new BaseResponse(await this.directorySyncConnectionService.verifyConnection(provider));
  }

  @Get("connection/organizational-units")
  @RequirePermission(PERMISSIONS.DIRECTORY_SYNC_MANAGE)
  @ApiOperation({ summary: "List organizational units for the sync scope picker" })
  @Validate({
    request: [providerParam],
    response: baseResponse(Type.Array(directoryOrganizationalUnitSchema)),
  })
  async listDirectorySyncOrganizationalUnits(
    @Param("provider") provider: DirectorySyncProvider,
  ): Promise<BaseResponse<DirectoryOrganizationalUnitResponse[]>> {
    return new BaseResponse(
      await this.directorySyncConnectionService.listOrganizationalUnits(provider),
    );
  }

  @Get("connection/groups")
  @RequirePermission(PERMISSIONS.DIRECTORY_SYNC_MANAGE)
  @ApiOperation({ summary: "Search directory groups for the scope and role mapping pickers" })
  @Validate({
    request: [
      providerParam,
      { type: "query", name: "search", schema: Type.Optional(Type.String({ maxLength: 100 })) },
    ],
    response: baseResponse(Type.Array(directoryGroupSchema)),
  })
  async searchDirectorySyncGroups(
    @Param("provider") provider: DirectorySyncProvider,
    @Query("search") searchPhrase?: string,
  ): Promise<BaseResponse<DirectoryGroupResponse[]>> {
    return new BaseResponse(
      await this.directorySyncConnectionService.searchGroups(provider, searchPhrase ?? ""),
    );
  }

  @Put("connection/role-mappings")
  @RequirePermission(PERMISSIONS.DIRECTORY_SYNC_MANAGE)
  @ApiOperation({ summary: "Replace the directory group to role mappings" })
  @Validate({
    request: [providerParam, { type: "body", schema: replaceDirectorySyncRoleMappingsSchema }],
    response: baseResponse(directorySyncConnectionResponseSchema),
  })
  async replaceDirectorySyncRoleMappings(
    @Param("provider") provider: DirectorySyncProvider,
    @Body() roleMappings: ReplaceDirectorySyncRoleMappingsBody,
  ): Promise<BaseResponse<DirectorySyncConnectionResponse>> {
    return new BaseResponse(
      await this.directorySyncConnectionService.replaceRoleMappings(provider, roleMappings),
    );
  }

  @Put("connection/group-mappings")
  @RequirePermission(PERMISSIONS.DIRECTORY_SYNC_MANAGE)
  @ApiOperation({ summary: "Replace the directory group to Mentingo group mappings" })
  @Validate({
    request: [providerParam, { type: "body", schema: replaceDirectorySyncGroupMappingsSchema }],
    response: baseResponse(directorySyncConnectionResponseSchema),
  })
  async replaceDirectorySyncGroupMappings(
    @Param("provider") provider: DirectorySyncProvider,
    @Body() groupMappings: ReplaceDirectorySyncGroupMappingsBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<DirectorySyncConnectionResponse>> {
    return new BaseResponse(
      await this.directorySyncConnectionService.replaceGroupMappings(
        provider,
        groupMappings,
        currentUser,
      ),
    );
  }

  @Post("connection/synchronizations")
  @RequirePermission(PERMISSIONS.DIRECTORY_SYNC_MANAGE)
  @ApiOperation({ summary: "Queue a directory sync now" })
  @Validate({
    request: [providerParam],
    response: baseResponse(directorySyncRunSchema),
  })
  async requestManualDirectorySync(
    @Param("provider") provider: DirectorySyncProvider,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<DirectorySyncRunResponse>> {
    return new BaseResponse(
      await this.directorySyncConnectionService.requestManualSync(provider, currentUser),
    );
  }

  @Get("connection/runs")
  @RequirePermission(PERMISSIONS.DIRECTORY_SYNC_MANAGE)
  @ApiOperation({ summary: "List directory sync runs, newest first" })
  @Validate({
    request: [
      providerParam,
      { type: "query", name: "page", schema: Type.Integer({ minimum: 1, default: 1 }) },
      {
        type: "query",
        name: "perPage",
        schema: Type.Integer({ minimum: 1, maximum: 100, default: 20 }),
      },
    ],
    response: paginatedResponse(Type.Array(directorySyncRunSchema)),
  })
  async listDirectorySyncRuns(
    @Param("provider") provider: DirectorySyncProvider,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
  ): Promise<PaginatedResponse<DirectorySyncRunResponse[]>> {
    return new PaginatedResponse(
      await this.directorySyncConnectionService.listRuns(provider, page, perPage),
    );
  }

  @Delete("connection")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PERMISSIONS.DIRECTORY_SYNC_MANAGE)
  @ApiOperation({ summary: "Disconnect directory sync; synced users stay as they are" })
  @Validate({ request: [providerParam] })
  async deleteDirectorySyncConnection(
    @Param("provider") provider: DirectorySyncProvider,
  ): Promise<void> {
    await this.directorySyncConnectionService.deleteConnection(provider);
  }
}
