import { Controller, Get, Param } from "@nestjs/common";

import { BaseResponse, UUIDType } from "src/common";

import { AutomationLogsRepository } from "../repositories/automation-logs/automation-logs";

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
