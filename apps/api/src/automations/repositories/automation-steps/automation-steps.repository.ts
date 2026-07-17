import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { automationSteps } from "src/storage/schema";

import type { AutomationStepRecordInput } from "src/announcements/types/automations-source.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AutomationStepsRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async createAutomationStep(input: AutomationStepRecordInput) {
    const [createdStep] = await this.db
      .insert(automationSteps)
      .values({
        parentId: input.parentId,
        automationId: input.automationId,
        type: input.type,
        typeContext: input.typeContext,
      })
      .returning();

    return createdStep.id;
  }

  async getAllAutomationStepsByAutomationId(automationId: UUIDType) {
    return this.db
      .select()
      .from(automationSteps)
      .where(eq(automationSteps.automationId, automationId));
  }

  async getAutomationStepById(stepId: UUIDType) {
    const [step] = await this.db
      .select()
      .from(automationSteps)
      .where(eq(automationSteps.id, stepId));

    return step;
  }

  async updateAutomationStep(stepId: UUIDType, input: AutomationStepRecordInput) {
    const [updatedStep] = await this.db
      .update(automationSteps)
      .set({
        parentId: input.parentId,
        automationId: input.automationId,
        type: input.type,
        typeContext: input.typeContext,
      })
      .where(eq(automationSteps.id, stepId))
      .returning();

    return updatedStep?.id;
  }

  async deleteAutomationStep(stepId: UUIDType) {
    const [deletedStep] = await this.db
      .delete(automationSteps)
      .where(eq(automationSteps.id, stepId))
      .returning();

    return deletedStep?.id;
  }
}
