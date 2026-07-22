import { Injectable } from "@nestjs/common";

import { AutomationStepsService } from "../automations-steps/automations-steps.service";

import type { UUIDType } from "src/common";

@Injectable()
export class AutomationRunnerService {
  constructor(private readonly automationStepsService: AutomationStepsService) {}

  async startAutomation(automationId: UUIDType) {
    const automationSteps = this.automationStepsService.getAllAutomationSteps(automationId);
    console.log(automationSteps);
  }
}
