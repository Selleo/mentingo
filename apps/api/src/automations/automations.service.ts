import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import {
  buildJsonbFieldWithMultipleEntries,
  mergeJsonbField,
} from "src/common/helpers/sqlHelpers";
import { DB } from "src/storage/db/db.providers";
import { automations, automationSteps } from "src/storage/schema";
import { toJsonbBuildObject } from "src/utils/jsonb";

import { AutomationsRepository } from "./repositories/automations/automations.repository";
import { validateAutomationStepTree } from "./schemas/automation-tree.validation";

import type {
  AutomationRecordInput,
  AutomationRecordUpdateInput,
 AutomationStepBulkUpdate } from "src/announcements/types/automations-source.types";
import type { AutomationStatus } from "src/announcements/types/automations.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AutomationsService {
  constructor(
    private readonly automationsRepository: AutomationsRepository,
    @Inject(DB) private readonly db: DatabasePg,
  ) {}

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

  async saveAutomation(
    automationId: UUIDType,
    metadata: AutomationRecordUpdateInput,
    steps: AutomationStepBulkUpdate[],
  ) {
    return this.db.transaction(async (tx) => {
      const [updatedAutomation] = await tx
        .update(automations)
        .set({
          ...(metadata.name !== undefined && {
            name: mergeJsonbField(
              automations.name,
              buildJsonbFieldWithMultipleEntries(metadata.name),
            ),
          }),
          ...(metadata.description !== undefined && {
            description: mergeJsonbField(
              automations.description,
              buildJsonbFieldWithMultipleEntries(metadata.description),
            ),
          }),
          ...(metadata.status !== undefined && { status: metadata.status }),
        })
        .where(eq(automations.id, automationId))
        .returning({ id: automations.id });

      if (!updatedAutomation) {
        throw new BadRequestException("Automation not found");
      }

      validateAutomationStepTree(automationId, steps);

      await tx.delete(automationSteps).where(eq(automationSteps.automationId, automationId));
      if (steps.length > 0) {
        await tx.insert(automationSteps).values(
          steps.map((step) => ({
            id: step.id,
            parentId: step.parentId,
            automationId,
            type: step.type,
            typeContext: toJsonbBuildObject(step.typeContext),
          })),
        );
      }

      return { id: automationId, stepCount: steps.length };
    });
  }

  async deleteAutomation(automationId: UUIDType) {
    const deletedId = await this.automationsRepository.deleteAutomation(automationId);
    if (!deletedId) {
      throw new BadRequestException("Error while deleting the automation");
    }
    return deletedId;
  }
}
