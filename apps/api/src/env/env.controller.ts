import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { BulkUpsertEnvBody, bulkUpsertEnvSchema, getEnvResponseSchema } from "src/env/env.schema";
import { EnvService } from "src/env/services/env.service";
import { USER_ROLES } from "src/user/schemas/userRoles";

@Controller("env")
@UseGuards(RolesGuard)
export class EnvController {
  constructor(private readonly envService: EnvService) {}

  @Get(":envName")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "param", name: "envName", schema: Type.String() }],
    response: baseResponse(getEnvResponseSchema),
  })
  async getEnvKey(@Param("envName") envName: string) {
    return new BaseResponse(await this.envService.getEnv(envName));
  }

  @Post("bulk")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "body", name: "bulkUpsertEnvBody", schema: bulkUpsertEnvSchema }],
  })
  async bulkUpsertEnv(@Body() data: BulkUpsertEnvBody) {
    await this.envService.bulkUpsertEnv(data);
    return new BaseResponse({ message: "Upserted secrets successfully" });
  }
}
