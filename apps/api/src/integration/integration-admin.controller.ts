import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  ApiForbiddenResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { IntegrationService } from "src/integration/integration.service";
import {
  integrationCurrentKeyResponseSchema,
  rotateIntegrationKeyResponseSchema,
  type IntegrationCurrentKeyResponse,
  type RotateIntegrationKeyResponse,
} from "src/integration/schemas/integration-key.schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

@ApiTags("Integration Admin")
@ApiUnauthorizedResponse({
  description: "Authentication required.",
})
@ApiForbiddenResponse({
  description: "Admin role required.",
})
@Controller("integration/key")
@UseGuards(RolesGuard)
export class IntegrationAdminController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Get()
  @Roles(USER_ROLES.ADMIN)
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
  @Roles(USER_ROLES.ADMIN)
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
