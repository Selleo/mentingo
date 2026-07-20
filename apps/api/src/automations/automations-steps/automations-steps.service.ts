import { BadRequestException, Injectable } from "@nestjs/common";

import { AutomationStepsRepository } from "../repositories/automation-steps/automation-steps.repository";

import type { AutomationStepRecordInput } from "src/announcements/types/automations-source.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AutomationStepsService {
  constructor(private readonly automationStepsRepository: AutomationStepsRepository) {}

  async createAutomationStep(input: AutomationStepRecordInput) {
    await this.validateStep(input);
    return this.automationStepsRepository.createAutomationStep(input);
  }

  async getAllAutomationSteps(automationId: UUIDType) {
    return this.automationStepsRepository.getAllAutomationStepsByAutomationId(automationId);
  }

  async getAutomationStepById(stepId: UUIDType) {
    const step = await this.automationStepsRepository.getAutomationStepById(stepId);

    if (!step) {
      throw new BadRequestException("Automation step not found");
    }

    return step;
  }

  async updateAutomationStep(stepId: UUIDType, input: AutomationStepRecordInput) {
    const stepToUpdate = await this.getAutomationStepById(stepId);
    const isIdMismatch =
      stepToUpdate.parentId != input.parentId || stepToUpdate.automationId != input.automationId;
    if (isIdMismatch) {
      throw new BadRequestException("You can't change step's parent or automation");
    }

    await this.validateStep(input);

    const updatedId = await this.automationStepsRepository.updateAutomationStep(stepId, input);

    if (!updatedId) {
      throw new BadRequestException("Couldn't update automation step");
    }

    return updatedId;
  }

  async deleteAutomationStep(stepId: UUIDType) {
    const deletedId = await this.automationStepsRepository.deleteAutomationStep(stepId);

    if (!deletedId) {
      throw new BadRequestException("Error while deleting automation step");
    }

    return deletedId;
  }

  private async hasNoSteps(automationId: UUIDType) {
    const allSteps = await this.getAllAutomationSteps(automationId);

    if (allSteps.length == 0) return true;
    return false;
  }

  private async validateStep(input: AutomationStepRecordInput) {
    const hasNoSteps = await this.hasNoSteps(input.automationId);

    if (hasNoSteps && input.parentId != null) {
      throw new BadRequestException("Empty automation has to have root step first");
    }

    if (!hasNoSteps && input.parentId == null) {
      throw new BadRequestException("Automation already has a root step");
    }
  }
}
