import { Inject, Injectable } from "@nestjs/common";
import { AUTOMATION_EMAIL_DELIVERY_STATUSES, AUTOMATION_RUN_STATUSES } from "@repo/shared";
import { and, asc, eq, inArray, lt, notInArray } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { automationEmailDeliveries, automationRuns, emailTemplates } from "src/storage/schema";

import type { AutomationRecoveryUpdate } from "../automation-execution.types";

@Injectable()
export class AutomationRecoveryAndCleanupRepository {
  constructor(@Inject(DB) private readonly database: DatabasePg) {}

  listInterruptedAutomationDeliveries(cutoff: string, transaction: DatabasePg) {
    return transaction
      .select({
        id: automationEmailDeliveries.id,
        runId: automationEmailDeliveries.runId,
        attemptCount: automationEmailDeliveries.attemptCount,
        status: automationEmailDeliveries.status,
        template: automationEmailDeliveries.template,
        templateVersion: automationEmailDeliveries.templateVersion,
      })
      .from(automationEmailDeliveries)
      .where(
        and(
          eq(automationEmailDeliveries.status, AUTOMATION_EMAIL_DELIVERY_STATUSES.PROCESSING),
          lt(automationEmailDeliveries.claimedAt, cutoff),
        ),
      );
  }

  listAutomationRunsById(id: UUIDType, transaction: DatabasePg) {
    return transaction.select().from(automationRuns).where(eq(automationRuns.id, id));
  }

  listAutomationEmailTemplatesById(id: UUIDType, transaction: DatabasePg) {
    return transaction.select().from(emailTemplates).where(eq(emailTemplates.id, id));
  }

  updateRecoveredAutomationEmailDelivery(
    id: UUIDType,
    values: AutomationRecoveryUpdate,
    transaction: DatabasePg,
  ) {
    return transaction
      .update(automationEmailDeliveries)
      .set(values)
      .where(eq(automationEmailDeliveries.id, id));
  }

  listActiveAutomationEmailDeliverySteps() {
    return this.database
      .select({
        id: automationEmailDeliveries.id,
        runId: automationEmailDeliveries.runId,
        stepId: automationEmailDeliveries.stepId,
        recipientItemId: automationEmailDeliveries.recipientItemId,
        status: automationEmailDeliveries.status,
        stepOrder: automationEmailDeliveries.stepOrder,
      })
      .from(automationEmailDeliveries)
      .where(
        inArray(automationEmailDeliveries.status, [
          AUTOMATION_EMAIL_DELIVERY_STATUSES.PENDING,
          AUTOMATION_EMAIL_DELIVERY_STATUSES.RETRYING,
          AUTOMATION_EMAIL_DELIVERY_STATUSES.PROCESSING,
        ]),
      )
      .orderBy(asc(automationEmailDeliveries.stepOrder));
  }

  listActiveAutomationRuns() {
    return this.database
      .select()
      .from(automationRuns)
      .where(
        inArray(automationRuns.status, [
          AUTOMATION_RUN_STATUSES.PENDING,
          AUTOMATION_RUN_STATUSES.PROCESSING,
        ]),
      );
  }

  deleteExpiredCompletedAutomationRuns(cutoff: string) {
    return this.database
      .delete(automationRuns)
      .where(
        and(
          lt(automationRuns.completedAt, cutoff),
          notInArray(automationRuns.status, [
            AUTOMATION_RUN_STATUSES.PENDING,
            AUTOMATION_RUN_STATUSES.PROCESSING,
          ]),
        ),
      );
  }
}
