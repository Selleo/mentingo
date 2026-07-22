import { BadRequestException, Injectable } from "@nestjs/common";
import { AUTOMATION_TRIGGER_MAP } from "@repo/shared";

import { AutomationStepsService } from "../automations-steps/automations-steps.service";

import type { TriggerType } from "@repo/shared";
import type { AutomationStep, typeContext } from "src/announcements/types/automations-source.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AutomationRunnerService {
  constructor(private readonly automationStepsService: AutomationStepsService) {}

  async startAutomation(automationId: UUIDType, eventName: TriggerType) {
    const automationSteps = await this.automationStepsService.getAllAutomationSteps(automationId);
    await this.executeAutomationSteps(automationSteps, eventName);
  }
  private async executeAutomationSteps(steps: AutomationStep[], eventName: TriggerType) {
    const root = steps.find((step) => step.parentId === null);

    if (!root) {
      throw new BadRequestException("automationSteps.toast.stepTreeBuildFailed");
    }

    await this.executeStep(root, steps, eventName);
  }

  private async executeStep(step: AutomationStep, steps: AutomationStep[], eventName: TriggerType) {
    await this.executeSingleStep(step, eventName);

    const children = steps.filter((child) => child.parentId === step.id);

    for (const child of children) {
      await this.executeStep(child, steps, eventName);
    }
  }

  private async executeSingleStep(step: AutomationStep, eventName: TriggerType) {
    switch (step.type) {
      case "trigger":
        console.log("Trigger:", step.typeContext);
        break;

      case "condition":
        console.log("Condition:", step.typeContext);
        break;

      case "action":
        const trigger = AUTOMATION_TRIGGER_MAP[eventName as TriggerType];

        console.log("trigger event", trigger);
        console.log("values", trigger.providedVariables);

        break;

      default:
        throw new BadRequestException(`Unknown step type ${step.type}`);
    }
  }

  private async handleAction(actionContext: typeContext) {
    switch (actionContext.name) {
      case "send_email":
        console.log("email sent");
    }
  }
}
