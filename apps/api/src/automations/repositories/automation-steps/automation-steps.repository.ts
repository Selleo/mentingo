import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { automationSteps } from "src/storage/schema";
import { toJsonbBuildObject } from "src/utils/jsonb";

import type {
  AutomationStepBulkUpdate,
  AutomationStepRecordInput,
} from "src/announcements/types/automations-source.types";
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
        typeContext: toJsonbBuildObject(input.typeContext),
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
        typeContext: toJsonbBuildObject(input.typeContext),
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

  async replaceAutomationStepTree(automationId: UUIDType, steps: AutomationStepBulkUpdate[]) {
    return this.db.transaction(async (tx) => {
      await tx.delete(automationSteps).where(eq(automationSteps.automationId, automationId));

      await tx.insert(automationSteps).values(
        steps.map((step) => ({
          id: step.id,
          parentId: step.parentId,
          automationId,
          type: step.type,
          typeContext: toJsonbBuildObject(step.typeContext),
        })),
      );
      return true;
    });
  }
  //.where(sql`${automationSteps.typeContext}::text LIKE ${`%${triggerName}%`}`);
  async findAutomationTriggerToRun(triggerName: string) {
    return this.db
      .select()
      .from(automationSteps)
      .where(sql`${automationSteps.typeContext} ->> 'name' LIKE ${triggerName}`);
  }
}
