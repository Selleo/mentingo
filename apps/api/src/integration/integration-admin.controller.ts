import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  ApiForbiddenResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from "@nestjs/swagger";
import { PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { IntegrationService } from "src/integration/integration.service";
import {
  integrationCurrentKeyResponseSchema,
  rotateIntegrationKeyResponseSchema,
  type IntegrationCurrentKeyResponse,
  type RotateIntegrationKeyResponse,
} from "src/integration/schemas/integration-key.schema";

@ApiTags("Integration Admin")
@ApiUnauthorizedResponse({
  description: "Authentication required.",
})
@ApiForbiddenResponse({
  description: "Admin role required.",
})
@Controller("integration/key")
@UseGuards(PermissionsGuard)
export class IntegrationAdminController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Get()
  @RequirePermission(PERMISSIONS.INTEGRATION_KEY_MANAGE)
  @ApiOperation({ summary: "Get current integration API key metadata for admin" })
  @Validate({
    response: baseResponse(integrationCurrentKeyResponseSchema),
  })
  async getCurrentKey(
    @CurrentUser("userId") userId: string,
  ): Promise<BaseResponse<IntegrationCurrentKeyResponse>> {
    return new BaseResponse(await this.integrationService.getCurrentAdminKey(userId));
  }

  @Post()
  @RequirePermission(PERMISSIONS.INTEGRATION_KEY_MANAGE)
  @ApiOperation({ summary: "Rotate integration API key for admin" })
  @Validate({
    response: baseResponse(rotateIntegrationKeyResponseSchema),
  })
  async rotateKey(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<RotateIntegrationKeyResponse>> {
    return new BaseResponse(await this.integrationService.rotateAdminKey(currentUser));
  }
}
