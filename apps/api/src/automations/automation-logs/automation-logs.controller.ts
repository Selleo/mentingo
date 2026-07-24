import { Controller, Get, Param } from "@nestjs/common";

import { UUIDType } from "src/common";

import { AutomationLogsRepository } from "../repositories/automation-logs/automation-logs";

@Controller("automation-logs")
export class AutomationLogsController {
  constructor(private readonly automationLogsRepository: AutomationLogsRepository) {}

  @Get("automation/:automationId")
  async getByAutomationId(@Param("automationId") automationId: UUIDType) {
    return this.automationLogsRepository.GetByAutomationId(automationId);
  }
}
