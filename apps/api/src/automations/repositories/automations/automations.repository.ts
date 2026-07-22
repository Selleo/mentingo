import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { automations } from "src/storage/schema";

import type { AutomationRecordInput } from "src/announcements/types/automations-source.types";
import type { AutomationStatus } from "src/announcements/types/automations.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AutomationsRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async getAllAutomationsByTenantId(tenantId: UUIDType) {
    return this.db.select().from(automations).where(eq(automations.tenantId, tenantId));
  }

  async getAutomationById(automationId: UUIDType) {
    const [automation] = await this.db
      .select()
      .from(automations)
      .where(eq(automations.id, automationId));
    return automation;
  }
  async createAutomation(input: AutomationRecordInput) {
    const [automation] = await this.db
      .insert(automations)
      .values({
        name: input.name,
        description: input.description,
        status: input.status,
      })
      .returning();

    return automation;
  }
  async updateAutomation(automationId: UUIDType, input: AutomationRecordInput) {
    const [updated] = await this.db
      .update(automations)
      .set({ name: input.name, description: input.description, status: input.status })
      .where(eq(automations.id, automationId))
      .returning();
    return updated.id;
  }

  async changeStatus(automationId: UUIDType, status: AutomationStatus) {
    const [updated] = await this.db
      .update(automations)
      .set({ status: status })
      .where(eq(automations.id, automationId))
      .returning();
    return updated.id;
  }

  async deleteAutomation(automationId: UUIDType) {
    const [deleted] = await this.db
      .delete(automations)
      .where(eq(automations.id, automationId))
      .returning();
    return deleted;
  }
}
