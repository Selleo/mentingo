import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiForbiddenResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from "@nestjs/swagger";
import { PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";
import { IntegrationService } from "src/integration/integration.service";
import {
  createIntegrationKeyResponseSchema,
  createIntegrationKeySchema,
  integrationKeysResponseSchema,
  type CreateIntegrationKeyBody,
  type CreateIntegrationKeyResponse,
  type IntegrationKeysResponse,
} from "src/integration/schemas/integration-key.schema";

@ApiTags("Integration Admin")
@ApiUnauthorizedResponse({
  description: "Authentication required.",
})
@ApiForbiddenResponse({
  description: "Admin role required.",
})
@Controller("integration/keys")
@UseGuards(PermissionsGuard)
export class IntegrationAdminController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Get()
  @RequirePermission(PERMISSIONS.INTEGRATION_KEY_MANAGE)
  @ApiOperation({ summary: "List active integration API keys of the current organization" })
  @Validate({
    response: baseResponse(integrationKeysResponseSchema),
  })
  async getKeys(
    @CurrentUser("tenantId") tenantId: UUIDType,
  ): Promise<BaseResponse<IntegrationKeysResponse>> {
    return new BaseResponse(await this.integrationService.getKeysForTenant(tenantId));
  }

  @Post()
  @RequirePermission(PERMISSIONS.INTEGRATION_KEY_MANAGE)
  @ApiOperation({
    summary: "Create an integration API key for the current organization",
    description: "The raw key is returned only once, in this response.",
  })
  @Validate({
    request: [{ type: "body", schema: createIntegrationKeySchema }],
    response: baseResponse(createIntegrationKeyResponseSchema),
  })
  async createKey(
    @Body() body: CreateIntegrationKeyBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<CreateIntegrationKeyResponse>> {
    return new BaseResponse(
      await this.integrationService.createKeyForTenant(
        currentUser.tenantId,
        body.name,
        currentUser,
      ),
    );
  }

  @Delete(":keyId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PERMISSIONS.INTEGRATION_KEY_MANAGE)
  @ApiOperation({ summary: "Revoke an integration API key of the current organization" })
  @Validate({
    request: [{ type: "param", name: "keyId", schema: UUIDSchema }],
  })
  async revokeKey(
    @Param("keyId") keyId: UUIDType,
    @CurrentUser("tenantId") tenantId: UUIDType,
  ): Promise<void> {
    await this.integrationService.revokeKeyForTenant(tenantId, keyId);
  }
}
