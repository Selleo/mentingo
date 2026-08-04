import { BadRequestException, Injectable } from "@nestjs/common";

import { AutomationsRepository } from "./repositories/automations/automations.repository";

import type {
  AutomationRecordInput,
  AutomationRecordUpdateInput,
} from "src/announcements/types/automations-source.types";
import type { AutomationStatus } from "src/announcements/types/automations.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AutomationsService {
  constructor(private readonly automationsRepository: AutomationsRepository) {}

  async createAutomation(input: AutomationRecordInput) {
    return this.automationsRepository.createAutomation(input);
  }

  async getAllAutomations(tenantId: UUIDType) {
    return this.automationsRepository.getAllAutomationsByTenantId(tenantId);
  }

  async getAutomationById(automationId: UUIDType) {
    const automation = await this.automationsRepository.getAutomationById(automationId);

    if (!automation) {
      throw new BadRequestException("Automation not found");
    }

    return automation;
  }

  async updateAutomation(automationId: UUIDType, input: AutomationRecordUpdateInput) {
    const updatedId = await this.automationsRepository.updateAutomation(automationId, input);
    if (!updatedId) {
      throw new BadRequestException("Couldn't update the automation");
    }
    return updatedId;
  }

  async updateStatus(automationId: UUIDType, status: AutomationStatus) {
    const updatedId = await this.automationsRepository.changeStatus(automationId, status);
    if (!updatedId) {
      throw new BadRequestException("Couldn't change the status of automation");
    }
    return updatedId;
  }

  async deleteAutomation(automationId: UUIDType) {
    const deletedId = await this.automationsRepository.deleteAutomation(automationId);
    if (!deletedId) {
      throw new BadRequestException("Error while deleting the automation");
    }
    return deletedId;
  }
}
