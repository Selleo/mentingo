import { Injectable, type OnModuleInit } from "@nestjs/common";
import {
  AUTOMATION_VALIDATION_ISSUE_CODES,
  AUTOMATION_EMAIL_DELIVERY_STATUSES,
  AUTOMATION_RUN_STATUSES,
  AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS,
  AUTOMATION_STEP_TYPES,
  AUTOMATION_TEMPLATE_TYPES,
  flattenAutomationWorkflow,
  evaluateAutomationWorkflow,
  type AutomationStep,
  type AutomationWorkflow,
  type AutomationStepTrace,
  type AutomationRunStatus,
  type AutomationTemplateReference,
} from "@repo/shared";

import { AutomationDefinitionStorageService } from "src/automations/services/automation-definition-storage.service";
import { OutboxDirectHandlerService } from "src/outbox/outbox-direct-handler.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { QueueService, QUEUE_NAMES } from "src/queue";
import { dbAls } from "src/storage/db/db-als.store";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  BUILT_IN_TEMPLATE_VERSION,
  AUTOMATION_EMAIL_DELIVERY_JOB_NAME,
  AUTOMATION_RETRY_DELAY_MS,
  CLAIMABLE_AUTOMATION_EMAIL_DELIVERY_STATUSES,
} from "../automation-execution.constants";
import {
  AutomationEmailDeliveryRequestedEvent,
  NotificationEvent,
} from "../events/notification-event";
import { AutomationEmailDeliveryRepository } from "../repositories/automation-email-delivery.repository";
import { AutomationRunCreationRepository } from "../repositories/automation-run-creation.repository";
import { acquireAutomationLifecycleLock } from "../utils/acquire-automation-lifecycle-lock";

import { AutomationRecipientResolverService } from "./automation-recipient-resolver.service";
import { DefaultAutomationSetupService } from "./default-automation-setup.service";

import type {
  AutomationRecipientEmailPlans,
  AutomationRunPlan,
  AutomationWorkflowEvaluationSummary,
  AutomationEmailDeliveryJob,
} from "../automation-execution.types";
import type { AutomationRecord } from "src/automations/automation.types";
import type { DatabasePg, UUIDType } from "src/common";

@Injectable()
export class AutomationRunCreationService implements OnModuleInit {
  constructor(
    private readonly automationDefinitionStorageService: AutomationDefinitionStorageService,
    private readonly automationRunCreationRepository: AutomationRunCreationRepository,
    private readonly automationEmailDeliveryRepository: AutomationEmailDeliveryRepository,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly outboxDirectHandlerService: OutboxDirectHandlerService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly queueService: QueueService,
    private readonly defaultAutomationSetupService: DefaultAutomationSetupService,
    private readonly automationRecipientResolverService: AutomationRecipientResolverService,
  ) {}

  onModuleInit(): void {
    this.outboxDirectHandlerService.register(
      NotificationEvent.name,
      async (payload, _id, transaction) => {
        await this.createAutomationRunsForNotificationEvent(
          payload as unknown as NotificationEvent,
          transaction,
        );
      },
    );

    this.outboxDirectHandlerService.register(
      AutomationEmailDeliveryRequestedEvent.name,
      async (payload) => {
        await this.enqueueAutomationEmailDelivery(String(payload.emailDeliveryId));
      },
    );
  }

  async createAutomationRunsForNotificationEvent(
    event: NotificationEvent,
    transaction?: DatabasePg,
  ): Promise<void> {
    if (transaction) {
      await this.createRunsForUnprocessedNotificationEvent(event, transaction);

      return;
    }

    await this.tenantDbRunnerService.transactionWithHandle((database) =>
      this.createRunsForUnprocessedNotificationEvent(event, database),
    );
  }

  async enqueueAutomationEmailDelivery(emailDeliveryId: UUIDType): Promise<void> {
    const tenantId = dbAls.getStore()?.tenantId;

    if (!tenantId) {
      throw new Error("Automation delivery requires tenant context");
    }

    const delivery =
      await this.automationEmailDeliveryRepository.findAutomationEmailDeliveryById(emailDeliveryId);

    if (!delivery || !CLAIMABLE_AUTOMATION_EMAIL_DELIVERY_STATUSES.includes(delivery.status)) {
      return;
    }

    await this.queueService.enqueue<AutomationEmailDeliveryJob>(
      QUEUE_NAMES.AUTOMATION_EMAIL,
      AUTOMATION_EMAIL_DELIVERY_JOB_NAME,
      { tenantId, emailDeliveryId },
      {
        jobId: this.buildAutomationEmailJobId(emailDeliveryId),
        attempts: AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS,
        backoff: { type: "exponential", delay: AUTOMATION_RETRY_DELAY_MS },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async isAutomationEmailDeliveryJobActive(emailDeliveryId: UUIDType): Promise<boolean> {
    const queue = this.queueService.getQueue(QUEUE_NAMES.AUTOMATION_EMAIL);
    const job = await queue.getJob(this.buildAutomationEmailJobId(emailDeliveryId));

    return job ? (await job.getState()) === "active" : false;
  }

  private buildAutomationEmailJobId(emailDeliveryId: UUIDType): string {
    return `automation-email-${emailDeliveryId}`;
  }

  private async createRunsForUnprocessedNotificationEvent(
    event: NotificationEvent,
    transaction: DatabasePg,
  ): Promise<void> {
    await acquireAutomationLifecycleLock(transaction);

    await this.defaultAutomationSetupService.ensureTenantDefaultAutomations(transaction);

    const occurrence = await this.automationRunCreationRepository.insertNotificationOccurrenceIfNew(
      event.occurrenceId,
      transaction,
    );

    if (!occurrence) {
      return;
    }

    const enabledAutomations =
      await this.automationDefinitionStorageService.listEnabledAutomations(transaction);

    for (const automation of enabledAutomations) {
      await this.startMatchingAutomationRun(automation, event, transaction);
    }
  }

  private async startMatchingAutomationRun(
    automation: AutomationRecord,
    event: NotificationEvent,
    transaction: DatabasePg,
  ): Promise<void> {
    if (!automation.appliedDefinition) {
      return;
    }

    const path = flattenAutomationWorkflow(automation.appliedDefinition.workflow);
    const trigger = path[0];

    if (
      trigger?.type !== AUTOMATION_STEP_TYPES.TRIGGER ||
      trigger.config.eventKind !== event.kind
    ) {
      return;
    }

    const plan = await this.planAutomationRun(
      automation.appliedDefinition.workflow,
      path,
      event,
      transaction,
    );

    const run = await this.recordPlannedAutomationRun(automation, event, plan, transaction);

    await this.createAndQueueRecipientDeliveries(run.id, plan.recipients, transaction);
  }

  private async planAutomationRun(
    workflow: AutomationWorkflow,
    path: AutomationStep[],
    event: NotificationEvent,
    transaction: DatabasePg,
  ): Promise<AutomationRunPlan> {
    const evaluation = this.summarizeEventWorkflowEvaluation(workflow, path, event);
    const recipientPlan = await this.planRecipientEmailSteps(workflow, path, event, transaction);
    const conditionFailed = evaluation.conditionFailed || recipientPlan.conditionFailed;
    const recipientSteps = recipientPlan.recipients;

    if (conditionFailed) {
      recipientSteps.clear();
    }

    return { steps: evaluation.steps, recipients: recipientSteps, conditionFailed };
  }

  private async recordPlannedAutomationRun(
    automation: AutomationRecord,
    event: NotificationEvent,
    plan: AutomationRunPlan,
    transaction: DatabasePg,
  ) {
    const { recipients: recipientSteps, conditionFailed } = plan;
    const hasRecipients = recipientSteps.size > 0;

    let status: AutomationRunStatus = AUTOMATION_RUN_STATUSES.SUCCEEDED;

    if (conditionFailed) {
      status = AUTOMATION_RUN_STATUSES.FAILED;
    } else if (hasRecipients) {
      status = AUTOMATION_RUN_STATUSES.PENDING;
    }

    const run = await this.automationRunCreationRepository.insertAutomationRun(
      {
        automationId: automation.id,
        automationName: automation.appliedDefinition!.name,
        emailAddresses: [
          ...new Set([...recipientSteps.values()].map(({ recipient }) => recipient.email)),
        ],
        occurrenceId: event.occurrenceId,
        eventKind: event.kind,
        executionVersion: automation.executionVersion,
        status,
        steps: plan.steps,
        failureReasonCode: conditionFailed
          ? AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_CONDITION_VALUE
          : null,
        completedAt: hasRecipients ? null : new Date().toISOString(),
      },
      transaction,
    );

    return run;
  }

  private summarizeEventWorkflowEvaluation(
    workflow: AutomationWorkflow,
    path: AutomationStep[],
    event: NotificationEvent,
  ): AutomationWorkflowEvaluationSummary {
    const trace = new Map<UUIDType, AutomationStepTrace>(
      path.map((step) => [
        step.id,
        {
          stepId: step.id,
          type: step.type,
          ...(step.type === AUTOMATION_STEP_TYPES.CONDITION ? { field: step.config.field } : {}),
          matchedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          trueCount: 0,
          falseCount: 0,
        },
      ]),
    );

    let conditionFailed = false;
    const sources = event.items?.length ? event.items : event.recipients;

    for (const source of sources) {
      const evaluation = evaluateAutomationWorkflow(workflow, source.eventFields);

      conditionFailed ||= Boolean(evaluation.issue);

      for (const result of evaluation.steps) {
        const summary = trace.get(result.stepId)!;

        summary.matchedCount += result.matchedCount;
        summary.skippedCount += result.skippedCount;
        summary.failedCount += result.failedCount;
        summary.trueCount += result.trueCount;
        summary.falseCount += result.falseCount;
      }
    }

    return { steps: [...trace.values()], conditionFailed };
  }

  private async planRecipientEmailSteps(
    workflow: AutomationWorkflow,
    path: AutomationStep[],
    event: NotificationEvent,
    transaction: DatabasePg,
  ): Promise<AutomationRecipientEmailPlans> {
    const recipientSteps: AutomationRecipientEmailPlans["recipients"] = new Map();
    let conditionFailed = false;
    let stepOrder = 0;

    for (const step of path) {
      if (step.type !== AUTOMATION_STEP_TYPES.SEND_EMAIL || !step.config.template) {
        continue;
      }

      const recipients = await this.automationRecipientResolverService.resolveAutomationRecipients(
        step,
        event,
        transaction,
      );

      for (const recipient of recipients) {
        const evaluation = evaluateAutomationWorkflow(workflow, recipient.eventFields);

        conditionFailed ||= Boolean(evaluation.issue);

        if (evaluation.issue || !evaluation.path.some((item) => item.id === step.id)) {
          continue;
        }

        const entry = recipientSteps.get(recipient.itemId) ?? { recipient, steps: [] };

        entry.steps.push({ step, stepOrder, recipient });
        recipientSteps.set(recipient.itemId, entry);
      }

      stepOrder++;
    }

    return { recipients: recipientSteps, conditionFailed };
  }

  private async createAndQueueRecipientDeliveries(
    runId: UUIDType,
    recipientSteps: AutomationRecipientEmailPlans["recipients"],
    transaction: DatabasePg,
  ): Promise<void> {
    for (const { steps } of recipientSteps.values()) {
      let firstEmailDeliveryId: UUIDType | undefined;

      for (const { step, stepOrder: deliveryStepOrder, recipient } of steps) {
        if (step.type !== AUTOMATION_STEP_TYPES.SEND_EMAIL || !step.config.template) {
          continue;
        }

        const templateVersion = await this.getEmailTemplatePublicationVersion(
          step.config.template,
          transaction,
        );

        const delivery = await this.automationRunCreationRepository.insertAutomationEmailDelivery(
          {
            runId,
            stepId: step.id,
            stepOrder: deliveryStepOrder,
            recipientItemId: recipient.itemId,
            recipientEmail: recipient.email,
            language: recipient.language,
            eventFields: recipient.eventFields,
            accountActionIntentId: recipient.accountActionIntentId,
            template: step.config.template,
            templateVersion,
            status: AUTOMATION_EMAIL_DELIVERY_STATUSES.PENDING,
          },
          transaction,
        );

        firstEmailDeliveryId ??= delivery.id;
      }

      if (firstEmailDeliveryId) {
        await this.outboxPublisher.publish(
          new AutomationEmailDeliveryRequestedEvent(firstEmailDeliveryId),
          transaction,
        );
      }
    }
  }

  private async getEmailTemplatePublicationVersion(
    template: AutomationTemplateReference,
    transaction: DatabasePg,
  ): Promise<number> {
    if (template.type === AUTOMATION_TEMPLATE_TYPES.BUILTIN) {
      return BUILT_IN_TEMPLATE_VERSION;
    }

    const publication =
      await this.automationEmailDeliveryRepository.findEmailTemplatePublicationById(
        template.id,
        transaction,
      );

    if (!publication) {
      throw new Error("Applied automation references an unavailable template");
    }

    return publication.publicationVersion;
  }
}
