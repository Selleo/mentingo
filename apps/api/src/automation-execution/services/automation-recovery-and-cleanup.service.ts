import { Injectable } from "@nestjs/common";
import { EMAIL_TEMPLATE_STATUSES } from "@repo/email-templates";
import {
  AUTOMATION_STATUSES,
  AUTOMATION_EMAIL_DELIVERY_STATUSES,
  AUTOMATION_RUN_RETENTION_DAYS,
  AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS,
  AUTOMATION_TEMPLATE_TYPES,
  type AutomationEmailDeliveryStatus,
} from "@repo/shared";

import { AutomationDefinitionStorageService } from "src/automations/services/automation-definition-storage.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  BUILT_IN_TEMPLATE_VERSION,
  AUTOMATION_EMAIL_DELIVERY_REASON_CODES,
  AUTOMATION_INTERRUPTED_DELIVERY_TIMEOUT_MS,
} from "../automation-execution.constants";
import { AutomationRecoveryAndCleanupRepository } from "../repositories/automation-recovery-and-cleanup.repository";
import { acquireAutomationLifecycleLock } from "../utils/acquire-automation-lifecycle-lock";

import { AutomationRunCreationService } from "./automation-run-creation.service";
import { AutomationRunStatusService } from "./automation-run-status.service";
import { DefaultAutomationSetupService } from "./default-automation-setup.service";
import { NotificationAccountActionService } from "./notification-account-action.service";

import type {
  AutomationDeliveriesByRun,
  InterruptedAutomationEmailDelivery,
  PendingAutomationEmailDelivery,
} from "../automation-execution.types";
import type { DatabasePg } from "src/common";

@Injectable()
export class AutomationRecoveryAndCleanupService {
  private isRunning = false;

  constructor(
    private readonly automationDefinitionStorageService: AutomationDefinitionStorageService,
    private readonly automationRecoveryAndCleanupRepository: AutomationRecoveryAndCleanupRepository,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly automationRunCreationService: AutomationRunCreationService,
    private readonly automationRunStatusService: AutomationRunStatusService,
    private readonly notificationAccountActionService: NotificationAccountActionService,
    private readonly defaultAutomationSetupService: DefaultAutomationSetupService,
  ) {}

  async recoverInterruptedAutomationDeliveries(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      await this.tenantDbRunnerService.runForEachTenant(() =>
        this.recoverTenantAutomationDeliveries(),
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async recoverTenantAutomationDeliveries(): Promise<void> {
    await this.tenantDbRunnerService.transactionWithHandle(async (transaction) => {
      await acquireAutomationLifecycleLock(transaction);

      await this.defaultAutomationSetupService.ensureTenantDefaultAutomations(transaction);

      const builtInTemplateVersion = BUILT_IN_TEMPLATE_VERSION;

      const cutoff = new Date(
        Date.now() - AUTOMATION_INTERRUPTED_DELIVERY_TIMEOUT_MS,
      ).toISOString();

      const interrupted =
        await this.automationRecoveryAndCleanupRepository.listInterruptedAutomationDeliveries(
          cutoff,
          transaction,
        );

      for (const delivery of interrupted) {
        if (
          await this.automationRunCreationService.isAutomationEmailDeliveryJobActive(delivery.id)
        ) {
          continue;
        }

        await this.recoverInterruptedAutomationEmailDelivery(
          delivery,
          builtInTemplateVersion,
          transaction,
        );
      }
    });

    await this.enqueuePendingAutomationActions();

    await this.notificationAccountActionService.purgeUnusedNotificationAccountActionIntents();
  }

  private async recoverInterruptedAutomationEmailDelivery(
    delivery: InterruptedAutomationEmailDelivery,
    builtInTemplateVersion: number,
    transaction: DatabasePg,
  ): Promise<void> {
    const changed = await this.hasAppliedAutomationDefinitionChanged(
      delivery,
      builtInTemplateVersion,
      transaction,
    );

    let status: AutomationEmailDeliveryStatus = AUTOMATION_EMAIL_DELIVERY_STATUSES.RETRYING;

    if (changed) {
      status = AUTOMATION_EMAIL_DELIVERY_STATUSES.CANCELLED;
    } else if (delivery.attemptCount >= AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS) {
      status = AUTOMATION_EMAIL_DELIVERY_STATUSES.FAILED;
    }

    const reasonCode = changed
      ? AUTOMATION_EMAIL_DELIVERY_REASON_CODES.LIVE_DEFINITION_CHANGED
      : AUTOMATION_EMAIL_DELIVERY_REASON_CODES.INTERRUPTED_DELIVERY;

    const completedAt =
      status === AUTOMATION_EMAIL_DELIVERY_STATUSES.RETRYING ? null : new Date().toISOString();

    await this.automationRecoveryAndCleanupRepository.updateRecoveredAutomationEmailDelivery(
      delivery.id,
      { status, reasonCode, completedAt },
      transaction,
    );

    if (changed) {
      await this.automationRunStatusService.cancelPendingAutomationRunEmailDeliveries(
        [delivery.runId],
        reasonCode,
        transaction,
      );

      return;
    }

    await this.automationRunStatusService.updateAutomationRunOutcomeFromDeliveries(
      transaction,
      delivery.runId,
    );
  }

  private async hasAppliedAutomationDefinitionChanged(
    delivery: InterruptedAutomationEmailDelivery,
    builtInTemplateVersion: number,
    transaction: DatabasePg,
  ): Promise<boolean> {
    const [run] = await this.automationRecoveryAndCleanupRepository.listAutomationRunsById(
      delivery.runId,
      transaction,
    );

    if (!run) {
      return true;
    }

    const [automation] = await this.automationDefinitionStorageService.getAutomationsByIds(
      [run.automationId],
      transaction,
    );

    if (
      !automation ||
      automation.status !== AUTOMATION_STATUSES.ENABLED ||
      automation.executionVersion !== run.executionVersion
    ) {
      return true;
    }

    if (delivery.template.type === AUTOMATION_TEMPLATE_TYPES.BUILTIN) {
      return delivery.templateVersion !== builtInTemplateVersion;
    }

    const [template] =
      await this.automationRecoveryAndCleanupRepository.listAutomationEmailTemplatesById(
        delivery.template.id,
        transaction,
      );

    return (
      !template ||
      template.status !== EMAIL_TEMPLATE_STATUSES.PUBLISHED ||
      template.publicationVersion !== delivery.templateVersion
    );
  }

  private async enqueuePendingAutomationActions(): Promise<void> {
    const deliveries =
      await this.automationRecoveryAndCleanupRepository.listActiveAutomationEmailDeliverySteps();

    const deliveriesByRun = this.groupAutomationDeliveriesByRunAndRecipient(deliveries);
    const runs = await this.automationRecoveryAndCleanupRepository.listActiveAutomationRuns();

    const enabledAutomations = await this.tenantDbRunnerService.transactionWithHandle(
      (transaction) => this.automationDefinitionStorageService.listEnabledAutomations(transaction),
    );

    const automationsById = new Map(
      enabledAutomations.map((automation) => [automation.id, automation]),
    );

    for (const run of runs) {
      const automation = automationsById.get(run.automationId);

      if (!automation?.appliedDefinition || automation.executionVersion !== run.executionVersion) {
        continue;
      }

      for (const recipientDeliveries of deliveriesByRun.get(run.id)?.values() ?? []) {
        const firstDelivery = recipientDeliveries[0];

        if (firstDelivery.status === AUTOMATION_EMAIL_DELIVERY_STATUSES.PROCESSING) {
          continue;
        }

        await this.automationRunCreationService.enqueueAutomationEmailDelivery(firstDelivery.id);
      }
    }
  }

  private groupAutomationDeliveriesByRunAndRecipient(
    deliveries: PendingAutomationEmailDelivery[],
  ): AutomationDeliveriesByRun {
    const deliveriesByRun: AutomationDeliveriesByRun = new Map();

    for (const delivery of deliveries) {
      const recipients = deliveriesByRun.get(delivery.runId) ?? new Map();
      const recipientDeliveries = recipients.get(delivery.recipientItemId) ?? [];

      recipientDeliveries.push(delivery);
      recipients.set(delivery.recipientItemId, recipientDeliveries);
      deliveriesByRun.set(delivery.runId, recipients);
    }

    return deliveriesByRun;
  }

  async purgeExpiredAutomationRuns(): Promise<void> {
    const cutoff = new Date(Date.now() - AUTOMATION_RUN_RETENTION_DAYS * 86400000).toISOString();

    await this.tenantDbRunnerService.runForEachTenant(async () => {
      await this.automationRecoveryAndCleanupRepository.deleteExpiredCompletedAutomationRuns(
        cutoff,
      );

      await this.notificationAccountActionService.purgeUnusedNotificationAccountActionIntents();
    });
  }
}
