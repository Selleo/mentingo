import { Controller, Get, Param } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";

import { BaseResponse, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";

import { AutomationLogsRepository } from "../repositories/automation-logs/automation-logs";

@RequirePermission(PERMISSIONS.AUTOMATION_MANAGE)
@Controller("automation-logs")
export class AutomationLogsController {
  constructor(private readonly automationLogsRepository: AutomationLogsRepository) {}

  @Get()
  async getAll() {
    const logs = await this.automationLogsRepository.getAll();
    return new BaseResponse(logs);
  }

  @Get("automation/:automationId")
  async getByAutomationId(@Param("automationId") automationId: UUIDType) {
    const logs = await this.automationLogsRepository.GetByAutomationId(automationId);
    return new BaseResponse(logs);
  }
}
