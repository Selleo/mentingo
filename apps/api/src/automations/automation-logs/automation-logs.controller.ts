import { Controller, Get, Param } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, UUIDSchema, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";

import { AutomationLogsRepository } from "../repositories/automation-logs/automation-logs";

@RequirePermission(PERMISSIONS.AUTOMATION_MANAGE)
@Controller("automation-logs")
export class AutomationLogsController {
  constructor(private readonly automationLogsRepository: AutomationLogsRepository) {}

  @Get()
  @Validate({ response: baseResponse(Type.Array(Type.Unknown())) })
  async getAll() {
    const logs = await this.automationLogsRepository.getAll();
    return new BaseResponse(logs);
  }

  @Get("automation/:automationId")
  @Validate({
    request: [{ type: "param", name: "automationId", schema: UUIDSchema }],
    response: baseResponse(Type.Array(Type.Unknown())),
  })
  async getByAutomationId(@Param("automationId") automationId: UUIDType) {
    const logs = await this.automationLogsRepository.getByAutomationId(automationId);
    return new BaseResponse(logs);
  }
}
