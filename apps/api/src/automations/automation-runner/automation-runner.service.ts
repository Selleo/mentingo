import { BadRequestException, Injectable } from "@nestjs/common";

import { AutomationStepsService } from "../automations-steps/automations-steps.service";

import type { AutomationEventTypes } from "../handlers/automations-handler";
import type { AutomationStep, TypeContext } from "src/announcements/types/automations-source.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AutomationRunnerService {
  constructor(private readonly automationStepsService: AutomationStepsService) {}

  async startAutomation(automationId: UUIDType, event: AutomationEventTypes) {
    const automationSteps = await this.automationStepsService.getAllAutomationSteps(automationId);
    await this.executeAutomationSteps(automationSteps, event);
  }
  private async executeAutomationSteps(steps: AutomationStep[], event: AutomationEventTypes) {
    const root = steps.find((step) => step.parentId === null);

    if (!root) {
      throw new BadRequestException("automationSteps.toast.stepTreeBuildFailed");
    }

    await this.executeStep(root, steps, event);
  }

  private async executeStep(
    step: AutomationStep,
    steps: AutomationStep[],
    event: AutomationEventTypes,
  ) {
    await this.executeSingleStep(step, event);

    const children = steps.filter((child) => child.parentId === step.id);

    for (const child of children) {
      await this.executeStep(child, steps, event);
    }
  }

  private async executeSingleStep(step: AutomationStep, event: AutomationEventTypes) {
    switch (step.type) {
      case "trigger":
        console.log("Trigger:", step.typeContext);
        break;

      case "condition":
        console.log("Condition:", step.typeContext);
        break;

      case "action":
        this.handleAction(step.typeContext as TypeContext, event);

        break;

      default:
        throw new BadRequestException(`Unknown step type ${step.type}`);
    }
  }

  private async handleAction(actionContext: TypeContext, event: AutomationEventTypes) {
    switch (actionContext.name) {
      case "send_email":
        this.retrieveKeysForTemplate(actionContext, event);
    }
  }
  private async retrieveKeysForTemplate(actionContext: TypeContext, event: AutomationEventTypes) {
    const variables = Object.fromEntries(
      actionContext.providedVariables.map(({ key }) => [
        key,
        event[key as keyof AutomationEventTypes],
      ]),
    );

    console.log("variables extracted", variables);

    return variables;
  }
}
