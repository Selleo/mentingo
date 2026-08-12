import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { automationLogs } from "src/storage/schema";

import type { AutomationLogRecordInput } from "src/announcements/types/automations-source.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AutomationLogsRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async create(input: AutomationLogRecordInput) {
    const [log] = await this.db
      .insert(automationLogs)
      .values({
        automationId: input.automationId,
        automationName: input.automationName,
        eventName: input.eventName,
        status: input.status,
        emailAddresses: input.emailAddresses,
        errorName: input.errorName,
      })
      .returning();

    return log;
  }

  async getById(id: UUIDType) {
    const [log] = await this.db.select().from(automationLogs).where(eq(automationLogs.id, id));

    return log;
  }

  async getAll() {
    return this.db.select().from(automationLogs);
  }

  async getByAutomationId(automationId: UUIDType) {
    return this.db
      .select()
      .from(automationLogs)
      .where(eq(automationLogs.automationId, automationId));
  }
}
