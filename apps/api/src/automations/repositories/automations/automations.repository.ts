import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbFieldWithMultipleEntries, mergeJsonbField } from "src/common/helpers/sqlHelpers";
import { DB } from "src/storage/db/db.providers";
import { automationLogs, automations } from "src/storage/schema";

import type {
  AutomationRecordInput,
  AutomationRecordUpdateInput,
} from "src/announcements/types/automations-source.types";
import type { AutomationStatus } from "src/announcements/types/automations.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AutomationsRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async getAllAutomationsByTenantId(tenantId: UUIDType) {
    return this.db
      .select({
        id: automations.id,
        name: automations.name,
        description: automations.description,
        status: automations.status,
        lastRun: sql<string | null>`max("automation_logs"."created_at")`.mapWith((value) =>
          value ? new Date(value).toISOString() : null,
        ),
        createdAt: automations.createdAt,
        updatedAt: automations.updatedAt,
      })
      .from(automations)
      .leftJoin(automationLogs, eq(automationLogs.automationId, automations.id))
      .where(eq(automations.tenantId, tenantId))
      .groupBy(
        automations.id,
        automations.name,
        automations.description,
        automations.status,
        automations.createdAt,
        automations.updatedAt,
      );
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
  async updateAutomation(automationId: UUIDType, input: AutomationRecordUpdateInput) {
    const setFields = {
      ...(input.name !== undefined && {
        name: mergeJsonbField(automations.name, buildJsonbFieldWithMultipleEntries(input.name)),
      }),
      ...(input.description !== undefined && {
        description: mergeJsonbField(
          automations.description,
          buildJsonbFieldWithMultipleEntries(input.description),
        ),
      }),
      ...(input.status !== undefined && { status: input.status }),
    };

    if (Object.keys(setFields).length === 0) return undefined;

    const [updated] = await this.db
      .update(automations)
      .set(setFields)
      .where(eq(automations.id, automationId))
      .returning();
    return updated?.id;
  }

  async changeStatus(automationId: UUIDType, status: AutomationStatus) {
    const [updated] = await this.db
      .update(automations)
      .set({ status })
      .where(eq(automations.id, automationId))
      .returning();
    return updated?.id;
  }

  async deleteAutomation(automationId: UUIDType) {
    const [deleted] = await this.db
      .delete(automations)
      .where(eq(automations.id, automationId))
      .returning();
    return deleted;
  }
}
