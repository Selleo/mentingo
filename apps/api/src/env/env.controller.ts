import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDType } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import {
  BulkUpsertEnvBody,
  bulkUpsertEnvSchema,
  frontendSSOEnabledResponseSchema,
  frontendStripeConfiguredResponseSchema,
  getEnvResponseSchema,
  stripePublishableKeyResponseSchema,
  isEnvSetupResponseSchema,
  aiConfiguredResponseSchema,
} from "src/env/env.schema";
import { EnvService } from "src/env/services/env.service";
import { USER_ROLES } from "src/user/schemas/userRoles";

@Controller("env")
@UseGuards(RolesGuard)
export class EnvController {
  constructor(private readonly envService: EnvService) {}

  @Post("bulk")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "body", name: "bulkUpsertEnvBody", schema: bulkUpsertEnvSchema }],
  })
  async bulkUpsertEnv(
    @Body() data: BulkUpsertEnvBody,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    await this.envService.bulkUpsertEnv(data, currentUser);
    return new BaseResponse({ message: "Upserted secrets successfully" });
  }

  @Public()
  @Get("frontend/sso")
  @Validate({
    response: baseResponse(frontendSSOEnabledResponseSchema),
  })
  async getFrontendSSOEnabled() {
    return new BaseResponse(await this.envService.getSSOEnabled());
  }

  @Public()
  @Get("stripe/publishable-key")
  @Validate({
    response: baseResponse(stripePublishableKeyResponseSchema),
  })
  async getStripePublishableKey() {
    const stripePublishableKey = await this.envService.getStripePublishableKey();

    return new BaseResponse({ publishableKey: stripePublishableKey });
  }

  @Get("frontend/stripe")
  @Validate({
    response: baseResponse(frontendStripeConfiguredResponseSchema),
  })
  async getStripeConfigured() {
    return new BaseResponse(await this.envService.getStripeConfigured());
  }

  @Get("ai")
  @Validate({
    response: baseResponse(aiConfiguredResponseSchema),
  })
  async getAIConfigured() {
    return new BaseResponse(await this.envService.getAIConfigured());
  }

  @Get("config/setup")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: baseResponse(isEnvSetupResponseSchema),
  })
  async getIsConfigSetup(@CurrentUser("userId") userId: UUIDType) {
    const setup = await this.envService.getEnvSetup(userId);
    return new BaseResponse(setup);
  }

  @Get(":envName")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "param", name: "envName", schema: Type.String() }],
    response: baseResponse(getEnvResponseSchema),
  })
  async getEnvKey(@Param("envName") envName: string) {
    return new BaseResponse(await this.envService.getEnv(envName));
  }
}
