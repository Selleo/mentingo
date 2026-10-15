import { Injectable } from "@nestjs/common";
import { EMAIL_TEMPLATE_STATUSES, getBuiltInTemplatePublication } from "@repo/email-templates";
import {
  AUTOMATION_EMAIL_DELIVERY_STATUSES,
  AUTOMATION_RUN_STATUSES,
  AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS,
  AUTOMATION_STATUSES,
  AUTOMATION_STEP_TYPES,
  AUTOMATION_TEMPLATE_TYPES,
  flattenAutomationWorkflow,
  type AutomationEmailDeliveryStatus,
  type SupportedLanguages,
} from "@repo/shared";

import { AutomationDefinitionStorageService } from "src/automations/services/automation-definition-storage.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  BUILT_IN_TEMPLATE_VERSION,
  ACTIVE_AUTOMATION_EMAIL_DELIVERY_STATUSES,
  AUTOMATION_EMAIL_DELIVERY_DIRECTIONS,
  AUTOMATION_EMAIL_DELIVERY_REASON_CODES,
  CLAIMABLE_AUTOMATION_EMAIL_DELIVERY_STATUSES,
} from "../automation-execution.constants";
import { AutomationEmailDeliveryRequestedEvent } from "../events/notification-event";
import { AutomationEmailDeliveryRepository } from "../repositories/automation-email-delivery.repository";
import { acquireAutomationLifecycleLock } from "../utils/acquire-automation-lifecycle-lock";

import { AutomationRunStatusService } from "./automation-run-status.service";

import type {
  AutomationEmailDeliveryRecord,
  ClaimedAutomationEmailDelivery,
  AutomationRunRecord,
} from "../automation-execution.types";
import type { DatabasePg, UUIDType } from "src/common";

@Injectable()
export class AutomationEmailDeliveryStateService {
  constructor(
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly automationDefinitionStorageService: AutomationDefinitionStorageService,
    private readonly automationEmailDeliveryRepository: AutomationEmailDeliveryRepository,
    private readonly automationRunStatusService: AutomationRunStatusService,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  async claimAutomationEmailDelivery(
    emailDeliveryId: UUIDType,
  ): Promise<ClaimedAutomationEmailDelivery | null> {
    return this.tenantDbRunnerService.transactionWithHandle(async (transaction) => {
      await acquireAutomationLifecycleLock(transaction);

      const delivery = await this.automationEmailDeliveryRepository.findAutomationEmailDeliveryById(
        emailDeliveryId,
        transaction,
        true,
      );

      if (!delivery || !CLAIMABLE_AUTOMATION_EMAIL_DELIVERY_STATUSES.includes(delivery.status)) {
        return null;
      }

      const run = await this.automationEmailDeliveryRepository.findAutomationRunById(
        delivery.runId,
        transaction,
      );

      if (!run) {
        throw new Error("Automation run is unavailable");
      }

      const step = await this.getCurrentDeliveryEmailStep(delivery, run, transaction);

      if (!step) {
        return null;
      }

      const publication = await this.loadDeliveryTemplatePublication(delivery, transaction);

      if (!publication) {
        return this.cancelAutomationEmailDelivery(
          delivery,
          AUTOMATION_EMAIL_DELIVERY_REASON_CODES.TEMPLATE_CHANGED,
          transaction,
        );
      }

      if (!(await this.canDeliverAfterPreviousEmail(delivery, transaction))) {
        return null;
      }

      if (delivery.attemptCount >= AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS) {
        await this.persistAutomationEmailDeliveryResult(
          transaction,
          delivery.id,
          AUTOMATION_EMAIL_DELIVERY_STATUSES.FAILED,
          AUTOMATION_EMAIL_DELIVERY_REASON_CODES.ATTEMPTS_EXHAUSTED,
        );

        return null;
      }

      const claimedDelivery = await this.markDeliveryAndRunProcessing(delivery, transaction);

      return { delivery: claimedDelivery, run, step, publication };
    });
  }

  async recordAutomationEmailDeliveryResult(
    emailDeliveryId: UUIDType,
    status: AutomationEmailDeliveryStatus,
    reasonCode: string | null,
    language?: SupportedLanguages | null,
    claimedAttemptCount?: number,
  ): Promise<AutomationEmailDeliveryStatus> {
    return this.tenantDbRunnerService.transactionWithHandle(async (transaction) => {
      await acquireAutomationLifecycleLock(transaction);

      return this.persistAutomationEmailDeliveryResult(
        transaction,
        emailDeliveryId,
        status,
        reasonCode,
        language,
        claimedAttemptCount,
      );
    });
  }

  private async markDeliveryAndRunProcessing(
    delivery: AutomationEmailDeliveryRecord,
    transaction: DatabasePg,
  ): Promise<AutomationEmailDeliveryRecord> {
    const claimedDelivery =
      await this.automationEmailDeliveryRepository.updateAutomationEmailDelivery(
        delivery.id,
        {
          status: AUTOMATION_EMAIL_DELIVERY_STATUSES.PROCESSING,
          attemptCount: delivery.attemptCount + 1,
          claimedAt: new Date().toISOString(),
          reasonCode: null,
        },
        transaction,
      );

    await this.automationEmailDeliveryRepository.updateAutomationRunStatus(
      delivery.runId,
      AUTOMATION_RUN_STATUSES.PROCESSING,
      transaction,
    );

    return claimedDelivery;
  }

  private async getCurrentDeliveryEmailStep(
    delivery: AutomationEmailDeliveryRecord,
    run: AutomationRunRecord,
    transaction: DatabasePg,
  ) {
    const [automation] = await this.automationDefinitionStorageService.getAutomationsByIds(
      [run.automationId],
      transaction,
    );

    if (
      !automation?.appliedDefinition ||
      automation.status !== AUTOMATION_STATUSES.ENABLED ||
      automation.executionVersion !== run.executionVersion
    ) {
      return this.cancelAutomationEmailDelivery(
        delivery,
        AUTOMATION_EMAIL_DELIVERY_REASON_CODES.AUTOMATION_CHANGED,
        transaction,
      );
    }

    const path = flattenAutomationWorkflow(automation.appliedDefinition.workflow);
    const stepIndex = path.findIndex((step) => step.id === delivery.stepId);
    const step = path[stepIndex];

    if (step?.type !== AUTOMATION_STEP_TYPES.SEND_EMAIL || !step.config.template) {
      return this.cancelAutomationEmailDelivery(
        delivery,
        AUTOMATION_EMAIL_DELIVERY_REASON_CODES.STEP_UNAVAILABLE,
        transaction,
      );
    }

    return step;
  }

  private async canDeliverAfterPreviousEmail(
    delivery: AutomationEmailDeliveryRecord,
    transaction: DatabasePg,
  ): Promise<boolean> {
    const previousDelivery =
      await this.automationEmailDeliveryRepository.findAdjacentRecipientAutomationEmailDelivery(
        delivery,
        AUTOMATION_EMAIL_DELIVERY_DIRECTIONS.PREVIOUS,
        transaction,
      );

    if (!previousDelivery) {
      return true;
    }

    return Boolean(
      previousDelivery &&
        previousDelivery.status !== AUTOMATION_EMAIL_DELIVERY_STATUSES.CANCELLED &&
        !ACTIVE_AUTOMATION_EMAIL_DELIVERY_STATUSES.includes(previousDelivery.status),
    );
  }

  private async loadDeliveryTemplatePublication(
    delivery: AutomationEmailDeliveryRecord,
    transaction: DatabasePg,
  ) {
    if (delivery.template.type === AUTOMATION_TEMPLATE_TYPES.BUILTIN) {
      return BUILT_IN_TEMPLATE_VERSION === delivery.templateVersion
        ? getBuiltInTemplatePublication(delivery.template.key)
        : null;
    }

    const template = await this.automationEmailDeliveryRepository.findEmailTemplatePublicationById(
      delivery.template.id,
      transaction,
      true,
    );

    if (
      !template?.publication ||
      template.status !== EMAIL_TEMPLATE_STATUSES.PUBLISHED ||
      template.publicationVersion !== delivery.templateVersion
    ) {
      return null;
    }

    return template.publication;
  }

  private async cancelAutomationEmailDelivery(
    delivery: AutomationEmailDeliveryRecord,
    reasonCode: string,
    transaction: DatabasePg,
  ): Promise<null> {
    await this.automationEmailDeliveryRepository.updateAutomationEmailDelivery(
      delivery.id,
      {
        status: AUTOMATION_EMAIL_DELIVERY_STATUSES.CANCELLED,
        reasonCode,
        completedAt: new Date().toISOString(),
      },
      transaction,
    );

    await this.automationRunStatusService.cancelPendingAutomationRunEmailDeliveries(
      [delivery.runId],
      reasonCode,
      transaction,
    );

    return null;
  }

  private async persistAutomationEmailDeliveryResult(
    transaction: DatabasePg,
    emailDeliveryId: UUIDType,
    status: AutomationEmailDeliveryStatus,
    reasonCode: string | null,
    language?: SupportedLanguages | null,
    claimedAttemptCount?: number,
  ): Promise<AutomationEmailDeliveryStatus> {
    const currentDelivery =
      await this.automationEmailDeliveryRepository.findAutomationEmailDeliveryById(
        emailDeliveryId,
        transaction,
        true,
      );

    if (!currentDelivery) {
      throw new Error("Automation delivery is unavailable");
    }

    // A late provider result cannot overwrite a recovered or superseded claim.
    if (
      claimedAttemptCount !== undefined &&
      (currentDelivery.status !== AUTOMATION_EMAIL_DELIVERY_STATUSES.PROCESSING ||
        currentDelivery.attemptCount !== claimedAttemptCount)
    ) {
      return currentDelivery.status;
    }

    if (
      status === AUTOMATION_EMAIL_DELIVERY_STATUSES.RETRYING &&
      !(await this.isAppliedAutomationDefinitionCurrent(currentDelivery, transaction))
    ) {
      status = AUTOMATION_EMAIL_DELIVERY_STATUSES.CANCELLED;
      reasonCode = AUTOMATION_EMAIL_DELIVERY_REASON_CODES.LIVE_DEFINITION_CHANGED;
    }

    const delivery = await this.automationEmailDeliveryRepository.updateAutomationEmailDelivery(
      emailDeliveryId,
      {
        status,
        reasonCode,
        ...(language ? { language } : {}),
        completedAt:
          status === AUTOMATION_EMAIL_DELIVERY_STATUSES.RETRYING ? null : new Date().toISOString(),
      },
      transaction,
    );

    if (status !== AUTOMATION_EMAIL_DELIVERY_STATUSES.RETRYING) {
      await this.enqueueSuccessorAutomationEmailDelivery(delivery, transaction);
    }

    await this.automationRunStatusService.updateAutomationRunOutcomeFromDeliveries(
      transaction,
      delivery.runId,
    );

    return status;
  }

  private async isAppliedAutomationDefinitionCurrent(
    delivery: AutomationEmailDeliveryRecord,
    transaction: DatabasePg,
  ): Promise<boolean> {
    const run = await this.automationEmailDeliveryRepository.findAutomationRunById(
      delivery.runId,
      transaction,
    );

    if (!run) {
      return false;
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
      return false;
    }

    if (delivery.template.type === AUTOMATION_TEMPLATE_TYPES.BUILTIN) {
      return delivery.templateVersion === BUILT_IN_TEMPLATE_VERSION;
    }

    const template = await this.automationEmailDeliveryRepository.findEmailTemplatePublicationById(
      delivery.template.id,
      transaction,
    );

    return Boolean(
      template &&
        template.status === EMAIL_TEMPLATE_STATUSES.PUBLISHED &&
        template.publicationVersion === delivery.templateVersion,
    );
  }

  private async enqueueSuccessorAutomationEmailDelivery(
    delivery: AutomationEmailDeliveryRecord,
    transaction: DatabasePg,
  ): Promise<void> {
    const run = await this.automationEmailDeliveryRepository.findAutomationRunById(
      delivery.runId,
      transaction,
    );

    if (!run) {
      return;
    }

    const [automation] = await this.automationDefinitionStorageService.getAutomationsByIds(
      [run.automationId],
      transaction,
    );

    if (
      !automation?.appliedDefinition ||
      automation.status !== AUTOMATION_STATUSES.ENABLED ||
      automation.executionVersion !== run.executionVersion
    ) {
      return;
    }

    const nextDelivery =
      await this.automationEmailDeliveryRepository.findAdjacentRecipientAutomationEmailDelivery(
        delivery,
        AUTOMATION_EMAIL_DELIVERY_DIRECTIONS.NEXT,
        transaction,
      );

    if (nextDelivery?.status === AUTOMATION_EMAIL_DELIVERY_STATUSES.PENDING) {
      await this.outboxPublisher.publish(
        new AutomationEmailDeliveryRequestedEvent(nextDelivery.id),
        transaction,
      );
    }
  }
}
