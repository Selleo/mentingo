import { Injectable } from "@nestjs/common";
import {
  AUTOMATION_EMAIL_DELIVERY_STATUSES,
  AUTOMATION_RUN_STATUSES,
  type AutomationRunStatus,
} from "@repo/shared";

import {
  ACTIVE_AUTOMATION_EMAIL_DELIVERY_STATUSES,
  AUTOMATION_EMAIL_DELIVERY_REASON_CODES,
} from "../automation-execution.constants";
import { AutomationRunStatusRepository } from "../repositories/automation-run-status.repository";

import type {
  AutomationEmailDeliveryOutcomeRecord,
  AutomationRunOutcome,
} from "../automation-execution.types";
import type { AutomationRuntime } from "src/automations/automation.types";
import type { DatabasePg, UUIDType } from "src/common";

@Injectable()
export class AutomationRunStatusService implements AutomationRuntime {
  constructor(private readonly automationRunStatusRepository: AutomationRunStatusRepository) {}

  async cancelPendingAutomationEmailDeliveries(
    transaction: DatabasePg,
    automationId: UUIDType,
    reasonCode: string,
  ): Promise<void> {
    const runs = await this.automationRunStatusRepository.listActiveAutomationRunIds(
      automationId,
      transaction,
    );

    await this.cancelPendingAutomationRunEmailDeliveries(
      runs.map((run) => run.id),
      reasonCode,
      transaction,
    );
  }

  async cancelAutomationEmailDeliveriesUsingCustomTemplate(
    transaction: DatabasePg,
    templateId: UUIDType,
  ): Promise<void> {
    const runs =
      await this.automationRunStatusRepository.listActiveAutomationRunIdsUsingCustomTemplate(
        templateId,
        transaction,
      );

    await this.cancelPendingAutomationRunEmailDeliveries(
      runs.map((run) => run.id),
      AUTOMATION_EMAIL_DELIVERY_REASON_CODES.TEMPLATE_REPUBLISHED,
      transaction,
    );
  }

  async updateAutomationRunOutcomeFromDeliveries(
    transaction: DatabasePg,
    runId: UUIDType,
  ): Promise<void> {
    const deliveries =
      await this.automationRunStatusRepository.listAutomationEmailDeliverySummaries(
        runId,
        transaction,
      );

    const outcome = this.summarizeAutomationEmailDeliveries(deliveries);

    await this.automationRunStatusRepository.updateAutomationRunOutcome(
      runId,
      outcome,
      transaction,
    );

    await this.scrubCompletedRecipientAutomationEmailPayloads(deliveries, transaction);
  }

  async cancelPendingAutomationRunEmailDeliveries(
    runIds: UUIDType[],
    reasonCode: string,
    transaction: DatabasePg,
  ): Promise<void> {
    if (runIds.length === 0) {
      return;
    }

    await this.automationRunStatusRepository.cancelPendingAutomationEmailDeliveries(
      runIds,
      reasonCode,
      new Date().toISOString(),
      transaction,
    );

    for (const runId of runIds) {
      await this.updateAutomationRunOutcomeFromDeliveries(transaction, runId);
    }
  }

  private summarizeAutomationEmailDeliveries(
    deliveries: AutomationEmailDeliveryOutcomeRecord[],
  ): AutomationRunOutcome {
    const succeededCount = deliveries.filter(
      (delivery) => delivery.status === AUTOMATION_EMAIL_DELIVERY_STATUSES.SUCCEEDED,
    ).length;

    const failedCount = deliveries.filter(
      (delivery) => delivery.status === AUTOMATION_EMAIL_DELIVERY_STATUSES.FAILED,
    ).length;

    const cancelledCount = deliveries.filter(
      (delivery) => delivery.status === AUTOMATION_EMAIL_DELIVERY_STATUSES.CANCELLED,
    ).length;

    const status = this.resolveAutomationRunStatus(
      deliveries,
      succeededCount,
      failedCount,
      cancelledCount,
    );

    return {
      status,
      succeededCount,
      failedCount,
      cancelledCount,
      failureReasonCode:
        deliveries.find((delivery) => delivery.status === AUTOMATION_EMAIL_DELIVERY_STATUSES.FAILED)
          ?.reasonCode ?? null,
      completedAt: status === AUTOMATION_RUN_STATUSES.PROCESSING ? null : new Date().toISOString(),
    };
  }

  private resolveAutomationRunStatus(
    deliveries: AutomationEmailDeliveryOutcomeRecord[],
    succeededCount: number,
    failedCount: number,
    cancelledCount: number,
  ): AutomationRunStatus {
    if (
      deliveries.some((delivery) =>
        ACTIVE_AUTOMATION_EMAIL_DELIVERY_STATUSES.includes(delivery.status),
      )
    ) {
      return AUTOMATION_RUN_STATUSES.PROCESSING;
    }

    if (failedCount > 0) {
      return succeededCount > 0 ? AUTOMATION_RUN_STATUSES.WARNINGS : AUTOMATION_RUN_STATUSES.FAILED;
    }

    if (cancelledCount > 0) {
      return succeededCount > 0
        ? AUTOMATION_RUN_STATUSES.WARNINGS
        : AUTOMATION_RUN_STATUSES.CANCELLED;
    }

    if (
      deliveries.some((delivery) => delivery.status === AUTOMATION_EMAIL_DELIVERY_STATUSES.SKIPPED)
    ) {
      return AUTOMATION_RUN_STATUSES.WARNINGS;
    }

    return AUTOMATION_RUN_STATUSES.SUCCEEDED;
  }

  private async scrubCompletedRecipientAutomationEmailPayloads(
    deliveries: AutomationEmailDeliveryOutcomeRecord[],
    transaction: DatabasePg,
  ): Promise<void> {
    const activeRecipientIds = new Set(
      deliveries
        .filter((delivery) => ACTIVE_AUTOMATION_EMAIL_DELIVERY_STATUSES.includes(delivery.status))
        .map((delivery) => delivery.recipientItemId),
    );

    const completedEmailDeliveryIds = deliveries
      .filter((delivery) => !activeRecipientIds.has(delivery.recipientItemId))
      .map((delivery) => delivery.id);

    if (completedEmailDeliveryIds.length > 0) {
      await this.automationRunStatusRepository.scrubAutomationEmailDeliveryPayloads(
        completedEmailDeliveryIds,
        transaction,
      );
    }
  }
}
