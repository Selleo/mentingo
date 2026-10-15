import { Injectable } from "@nestjs/common";
import { AUTOMATION_EMAIL_DELIVERY_STATUSES, AUTOMATION_TEMPLATE_TYPES } from "@repo/shared";
import { and, eq, inArray, sql } from "drizzle-orm";

import { automationEmailDeliveries, automationRuns } from "src/storage/schema";

import {
  ACTIVE_AUTOMATION_RUN_STATUSES,
  CLAIMABLE_AUTOMATION_EMAIL_DELIVERY_STATUSES,
} from "../automation-execution.constants";

import type { AutomationRunOutcome } from "../automation-execution.types";
import type { DatabasePg, UUIDType } from "src/common";

@Injectable()
export class AutomationRunStatusRepository {
  listActiveAutomationRunIds(automationId: UUIDType, transaction: DatabasePg) {
    return transaction
      .select({ id: automationRuns.id })
      .from(automationRuns)
      .where(
        and(
          eq(automationRuns.automationId, automationId),
          inArray(automationRuns.status, ACTIVE_AUTOMATION_RUN_STATUSES),
        ),
      );
  }

  listActiveAutomationRunIdsUsingCustomTemplate(templateId: UUIDType, transaction: DatabasePg) {
    return transaction
      .selectDistinct({ id: automationRuns.id })
      .from(automationRuns)
      .innerJoin(automationEmailDeliveries, eq(automationEmailDeliveries.runId, automationRuns.id))
      .where(
        and(
          sql`${automationEmailDeliveries.template}->>'type' = ${AUTOMATION_TEMPLATE_TYPES.CUSTOM} AND ${automationEmailDeliveries.template}->>'id' = ${templateId}`,
          inArray(automationRuns.status, ACTIVE_AUTOMATION_RUN_STATUSES),
        ),
      );
  }

  cancelPendingAutomationEmailDeliveries(
    runIds: UUIDType[],
    reasonCode: string,
    completedAt: string,
    transaction: DatabasePg,
  ) {
    return transaction
      .update(automationEmailDeliveries)
      .set({ status: AUTOMATION_EMAIL_DELIVERY_STATUSES.CANCELLED, reasonCode, completedAt })
      .where(
        and(
          inArray(automationEmailDeliveries.runId, runIds),
          inArray(automationEmailDeliveries.status, CLAIMABLE_AUTOMATION_EMAIL_DELIVERY_STATUSES),
        ),
      );
  }

  listAutomationEmailDeliverySummaries(runId: UUIDType, transaction: DatabasePg) {
    return transaction
      .select({
        id: automationEmailDeliveries.id,
        status: automationEmailDeliveries.status,
        recipientItemId: automationEmailDeliveries.recipientItemId,
        reasonCode: automationEmailDeliveries.reasonCode,
      })
      .from(automationEmailDeliveries)
      .where(eq(automationEmailDeliveries.runId, runId));
  }

  updateAutomationRunOutcome(
    runId: UUIDType,
    outcome: AutomationRunOutcome,
    transaction: DatabasePg,
  ) {
    return transaction.update(automationRuns).set(outcome).where(eq(automationRuns.id, runId));
  }

  scrubAutomationEmailDeliveryPayloads(emailDeliveryIds: UUIDType[], transaction: DatabasePg) {
    return transaction
      .update(automationEmailDeliveries)
      .set({ eventFields: null, accountActionIntentId: null })
      .where(inArray(automationEmailDeliveries.id, emailDeliveryIds));
  }
}
