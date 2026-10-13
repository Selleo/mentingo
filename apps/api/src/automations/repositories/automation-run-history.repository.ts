import { Injectable, Inject } from "@nestjs/common";
import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { automationRuns, automationEmailDeliveries } from "src/storage/schema";

import type { AutomationRunQuery } from "@repo/shared";

@Injectable()
export class AutomationRunHistoryRepository {
  constructor(@Inject(DB) private readonly database: DatabasePg) {}

  async findAutomationRunPage({
    page = 1,
    perPage = 20,
    automationId,
    status,
    search,
  }: AutomationRunQuery) {
    const conditions: SQL[] = [];

    if (automationId) {
      conditions.push(eq(automationRuns.automationId, automationId));
    }

    if (status) {
      conditions.push(eq(automationRuns.status, status));
    }

    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;

      conditions.push(
        or(
          ilike(automationRuns.automationName, pattern),
          ilike(automationRuns.eventKind, pattern),
          sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${automationRuns.emailAddresses}) address WHERE address ILIKE ${pattern})`,
        )!,
      );
    }

    return this.database.transaction(
      async (transaction) => {
        const [{ totalItems }] = await transaction
          .select({ totalItems: count() })
          .from(automationRuns)
          .where(and(...conditions));

        const records = await transaction
          .select()
          .from(automationRuns)
          .where(and(...conditions))
          .orderBy(desc(automationRuns.createdAt), desc(automationRuns.id))
          .limit(perPage)
          .offset((page - 1) * perPage);

        return {
          data: records,
          pagination: { totalItems, page, perPage },
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async findAutomationRunDetails(id: UUIDType) {
    return this.database.transaction(
      async (transaction) => {
        const [record] = await transaction
          .select()
          .from(automationRuns)
          .where(eq(automationRuns.id, id));

        const deliveries = await transaction
          .select({
            id: automationEmailDeliveries.id,
            runId: automationEmailDeliveries.runId,
            stepId: automationEmailDeliveries.stepId,
            stepOrder: automationEmailDeliveries.stepOrder,
            recipientItemId: automationEmailDeliveries.recipientItemId,
            recipientEmail: automationEmailDeliveries.recipientEmail,
            template: automationEmailDeliveries.template,
            status: automationEmailDeliveries.status,
            attemptCount: automationEmailDeliveries.attemptCount,
            language: automationEmailDeliveries.language,
            createdAt: automationEmailDeliveries.createdAt,
            completedAt: automationEmailDeliveries.completedAt,
            reasonCode: automationEmailDeliveries.reasonCode,
          })
          .from(automationEmailDeliveries)
          .where(eq(automationEmailDeliveries.runId, id))
          .orderBy(
            automationEmailDeliveries.recipientItemId,
            automationEmailDeliveries.stepOrder,
            automationEmailDeliveries.createdAt,
          );

        return { run: record, deliveries };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
