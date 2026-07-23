import { BadRequestException, Injectable } from "@nestjs/common";

import { AutomationStepsService } from "../automations-steps/automations-steps.service";

import type { AutomationStep, TypeContext } from "src/announcements/types/automations-source.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AutomationRunnerService {
  constructor(private readonly automationStepsService: AutomationStepsService) {}

  async startAutomation(automationId: UUIDType) {
    const automationSteps = await this.automationStepsService.getAllAutomationSteps(automationId);
    await this.executeAutomationSteps(automationSteps);
  }
  private async executeAutomationSteps(steps: AutomationStep[]) {
    const root = steps.find((step) => step.parentId === null);

    if (!root) {
      throw new BadRequestException("automationSteps.toast.stepTreeBuildFailed");
    }

    await this.executeStep(root, steps);
  }

  private async executeStep(step: AutomationStep, steps: AutomationStep[]) {
    await this.executeSingleStep(step);

    const children = steps.filter((child) => child.parentId === step.id);

    for (const child of children) {
      await this.executeStep(child, steps);
    }
  }

  private async executeSingleStep(step: AutomationStep) {
    switch (step.type) {
      case "trigger":
        console.log("Trigger:", step.typeContext);
        break;

      case "condition":
        console.log("Condition:", step.typeContext);
        break;

      case "action":
        this.handleAction(step.typeContext as TypeContext);

        break;

      default:
        throw new BadRequestException(`Unknown step type ${step.type}`);
    }
  }

  private async handleAction(actionContext: TypeContext) {
    switch (actionContext.name) {
      case "send_email":
        this.retrieveKeysForTemplate(actionContext);
    }
  }
  private async retrieveKeysForTemplate(actionContext: TypeContext) {
    const variables = Object.fromEntries(
      actionContext.providedVariables.map(({ key, value }) => [key, value]),
    );
    console.log("variables extracted", variables);
    return variables;
  }
}
