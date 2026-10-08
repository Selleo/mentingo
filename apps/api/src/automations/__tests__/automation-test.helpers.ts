import { randomUUID } from "node:crypto";

import { AUTOMATION_EVENT_KINDS, AUTOMATION_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { eq, isNotNull } from "drizzle-orm";
import request from "supertest";

import { NotificationEvent } from "src/automation-execution/events/notification-event";
import { AutomationEmailDeliveryService } from "src/automation-execution/services/automation-email-delivery.service";
import { DefaultAutomationSetupService } from "src/automation-execution/services/default-automation-setup.service";
import { AutomationEmailWorker } from "src/automation-execution/workers/automation-email.worker";
import { setupEmailTemplateTest } from "src/email-templates/__tests__/email-template-test.helpers";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { automations, automationRuns, automationOccurrences } from "src/storage/schema";

import type { AutomationResponse, AutomationRunDetailResponse } from "../schema/automation.schema";
import type { AutomationDefinition, AutomationSendEmailStep } from "@repo/shared";

export const createWelcomeAutomationDefinition = (): AutomationDefinition => {
  const trigger = randomUUID();

  return {
    name: "Automation E2E welcome",
    description: "A notification configured through HTTP",
    workflow: {
      rootStepId: trigger,
      steps: [
        {
          id: trigger,
          parentId: null,
          position: 0,
          type: "trigger",
          config: { eventKind: AUTOMATION_EVENT_KINDS.WELCOME },
        },
        {
          id: randomUUID(),
          parentId: trigger,
          position: 0,
          type: "send_email",
          config: {
            template: { type: "builtin", key: "welcome" },
            mappings: { courses_link: { type: "event_field", field: "courses_link" } },
          },
        },
      ],
    },
  };
};

export const getFirstEmailStep = (body: AutomationDefinition): AutomationSendEmailStep => {
  const step = body.workflow.steps.find((step) => step.type === "send_email");

  if (!step || step.type !== "send_email") {
    throw new Error("Fixture requires an email action");
  }

  return step;
};

export async function setupAutomationTestContext() {
  const t = await setupEmailTemplateTest({
    providers: [{ provide: AutomationEmailWorker, useValue: {} }],
  });

  const queue = t.app.get(QueueService).getQueue(QUEUE_NAMES.AUTOMATION_EMAIL);

  const requestAutomationApi = (
    method: "get" | "post" | "patch" | "delete",
    path = "",
    cookie = t.adminCookie,
    host?: string,
  ) => {
    const req = request(t.app.getHttpServer())[method](
      `/api${path.startsWith("/automation-runs") ? path : `/automations${path}`}`,
    );

    if (cookie) {
      req.set("Cookie", cookie);
    }

    if (host) {
      req.set("Referer", `${host}/`);
    }

    return req;
  };

  const createAutomation = async (body = createWelcomeAutomationDefinition()) =>
    (await requestAutomationApi("post").send(body).expect(201)).body.data as AutomationResponse;

  const getAutomation = async (id: string) =>
    (await requestAutomationApi("get", `/${id}`).expect(200)).body.data as AutomationResponse;

  const createEnabledAutomation = async (body = createWelcomeAutomationDefinition()) => {
    const created = await createAutomation(body);

    return (await requestAutomationApi("post", `/${created.id}/enable`).expect(201)).body
      .data as AutomationResponse;
  };

  const getAutomationRun = async (id: string) =>
    (await requestAutomationApi("get", `/automation-runs/${id}`).expect(200)).body
      .data as AutomationRunDetailResponse;

  const createWelcomeNotificationEvent = () =>
    new NotificationEvent(randomUUID(), AUTOMATION_EVENT_KINDS.WELCOME, [
      {
        itemId: t.student.id,
        email: t.student.email,
        name: `${t.student.firstName} ${t.student.lastName}`,
        language: SUPPORTED_LANGUAGES.EN,
        eventFields: { courses_link: "https://academy.example/courses" },
      },
    ]);

  const publishNotificationAndGetRuns = async (
    notification = createWelcomeNotificationEvent(),
    tenantId = t.defaultTenantId,
  ) => {
    await t.runAsTenant(tenantId, () => t.app.get(OutboxPublisher).publish(notification));

    return t.runAsTenant(tenantId, () =>
      t.db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.occurrenceId, notification.occurrenceId)),
    );
  };

  const deliverAutomationEmail = (id: string, tenantId = t.defaultTenantId) =>
    t.runAsTenant(tenantId, () =>
      t.app.get(AutomationEmailDeliveryService).sendAutomationEmail(id, tenantId),
    );

  const resetAutomationTestState = async () => {
    await queue.drain(true);

    for (const tenantId of [t.defaultTenantId, t.otherTenant.id]) {
      await t.runAsTenant(tenantId, async () => {
        await t.db.delete(automationRuns);
        await t.db.delete(automationOccurrences);
        await t.db.delete(automations);
        // Keep real lazy default setup, but disable defaults so custom test workflows are isolated.
        await t.app.get(DefaultAutomationSetupService).ensureTenantDefaultAutomations();
        await t.db
          .update(automations)
          .set({ status: AUTOMATION_STATUSES.DISABLED })
          .where(isNotNull(automations.builtInKey));
      });
    }

    await t.reset();
  };

  const closeAutomationTestContext = async () => {
    await queue.drain(true);
    await t.app.close();
  };

  return {
    ...t,
    requestEmailTemplateApi: t.http,
    createEmailTemplate: t.create,
    requestAutomationApi,
    createAutomation,
    getAutomation,
    createEnabledAutomation,
    createWelcomeNotificationEvent,
    publishNotificationAndGetRuns,
    deliverAutomationEmail,
    getAutomationRun,
    resetAutomationTestState,
    closeAutomationTestContext,
    queue,
  };
}

export type AutomationTestContext = Awaited<ReturnType<typeof setupAutomationTestContext>>;
