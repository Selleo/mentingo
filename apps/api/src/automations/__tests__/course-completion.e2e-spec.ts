import { randomUUID } from "node:crypto";

import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_NODE_KINDS,
  AUTOMATION_STATUSES,
  AUTOMATION_STEP_TYPES,
  AUTOMATION_TEMPLATE_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { and, eq, inArray, sql } from "drizzle-orm";

import { NotificationEvent } from "src/automation-execution/events/notification-event";
import { DefaultAutomationSetupService } from "src/automation-execution/services/default-automation-setup.service";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import {
  automations,
  automationSteps,
  automationEmailDeliveries,
  settings,
} from "src/storage/schema";

import { createCourseFactory } from "../../../test/factory/course.factory";
import { waitForOutbox } from "../../../test/helpers/wait-for-outbox";

import { setupAutomationTestContext, getFirstEmailStep } from "./automation-test.helpers";
import {
  COURSE_COMPLETION_DELIVERY_SCENARIOS,
  LEGACY_ADMIN_COMPLETION_EVENT_FIELDS,
} from "./course-completion.scenarios";

import type { AutomationTestContext } from "./automation-test.helpers";
import type { UUIDType } from "src/common";

const COURSE_COMPLETION_BUILT_IN_KEYS = [
  AUTOMATION_EVENT_KINDS.USER_FINISHED_COURSE,
  AUTOMATION_EVENT_KINDS.ADMIN_FINISHED_COURSE,
];

describe("shared course completion (e2e)", () => {
  let context: AutomationTestContext;

  beforeAll(async () => {
    context = await setupAutomationTestContext();
  });

  beforeEach(async () => {
    await context.resetAutomationTestState();
  });

  afterAll(async () => {
    await context?.closeAutomationTestContext();
  });

  const findAdminCourseCompletionAutomation = async () => {
    const [adminAutomation] = await context.db
      .select()
      .from(automations)
      .where(eq(automations.builtInKey, AUTOMATION_EVENT_KINDS.ADMIN_FINISHED_COURSE));

    if (!adminAutomation) throw new Error("Missing seeded admin course completion automation");

    return adminAutomation;
  };

  const enableCourseCompletionAutomations = () =>
    context.db
      .update(automations)
      .set({ status: AUTOMATION_STATUSES.ENABLED })
      .where(inArray(automations.builtInKey, COURSE_COMPLETION_BUILT_IN_KEYS));

  const setAdministratorCompletionOptIn = (userId: UUIDType, optedIn: boolean) =>
    context.db
      .update(settings)
      .set({
        settings: sql`jsonb_set(${settings.settings}, '{adminFinishedCourseNotification}', ${String(
          optedIn,
        )}::jsonb)`,
      })
      .where(eq(settings.userId, userId));

  const listTenantDeliveries = () =>
    context.runAsTenant(context.defaultTenantId, () =>
      context.db.select().from(automationEmailDeliveries),
    );

  it("reconciles persisted legacy built-ins without changing IDs, status or user mappings", async () => {
    await context.runAsTenant(context.defaultTenantId, async () => {
      const defaults = await context.db.select().from(automations);
      const adminAutomation = await findAdminCourseCompletionAutomation();
      const original = await context.getAutomation(adminAutomation.id);

      await context.db
        .update(automationSteps)
        .set({ configuration: { name: AUTOMATION_EVENT_KINDS.ADMIN_FINISHED_COURSE } })
        .where(
          and(
            eq(automationSteps.automationId, adminAutomation.id),
            eq(automationSteps.nodeKind, AUTOMATION_NODE_KINDS.TRIGGER),
          ),
        );
      await context.db
        .update(automationSteps)
        .set({ configuration: sql`${automationSteps.configuration} - 'recipients'` })
        .where(
          and(
            eq(automationSteps.automationId, adminAutomation.id),
            eq(automationSteps.nodeKind, AUTOMATION_NODE_KINDS.ACTION),
          ),
        );

      const upgraded = await context.getAutomation(adminAutomation.id);

      expect(upgraded).toMatchObject({
        id: original.id,
        status: original.status,
        executionVersion: original.executionVersion,
        name: original.name,
      });
      expect(
        upgraded.workflow.steps.find(({ type }) => type === AUTOMATION_STEP_TYPES.TRIGGER)?.config,
      ).toEqual({ eventKind: AUTOMATION_EVENT_KINDS.USER_FINISHED_COURSE });
      expect(getFirstEmailStep(upgraded).config).toEqual(getFirstEmailStep(original).config);

      await context.app.get(DefaultAutomationSetupService).ensureTenantDefaultAutomations();

      expect(await context.getAutomation(adminAutomation.id)).toEqual(upgraded);
      expect(await context.db.select().from(automations)).toHaveLength(defaults.length);
    });

    const response = await context.requestAutomationApi("get", "/events").expect(200);
    const courseCompletionKinds = response.body.data
      .map(({ kind }: { kind: string }) => kind)
      .filter((kind: string) => kind.endsWith("finished_course"));

    expect(courseCompletionKinds).toEqual([AUTOMATION_EVENT_KINDS.USER_FINISHED_COURSE]);
  });

  it.each(COURSE_COMPLETION_DELIVERY_SCENARIOS)(
    "emails the learner and only opted-in tenant administrators (opted in: $administratorOptedIn, certificate: $hasCertificate)",
    async ({ administratorOptedIn, hasCertificate, learnerTemplateKey }) => {
      await context.runAsTenant(context.otherTenant.id, () =>
        setAdministratorCompletionOptIn(context.otherAdmin.id, true),
      );

      const course = await context.runAsTenant(context.defaultTenantId, async () => {
        await setAdministratorCompletionOptIn(context.admin.id, administratorOptedIn);
        await enableCourseCompletionAutomations();

        return createCourseFactory(context.db).create({
          authorId: context.admin.id,
          hasCertificate,
        });
      });

      await context.runAsTenant(context.defaultTenantId, () =>
        context.app.get(OutboxPublisher).publish(
          new UserCourseFinishedEvent({
            userId: context.student.id,
            courseId: course.id,
            actor: {
              userId: context.student.id,
              email: context.student.email,
              roleSlugs: [],
              permissions: [],
              tenantId: context.defaultTenantId,
            },
          }),
        ),
      );

      const expectedRecipients = administratorOptedIn
        ? [context.student.email, context.admin.email]
        : [context.student.email];

      const deliveries = await waitForOutbox(
        context.app,
        listTenantDeliveries,
        (tenantDeliveries) => tenantDeliveries.length === expectedRecipients.length,
      );

      expect(
        deliveries.find(({ recipientEmail }) => recipientEmail === context.student.email),
      ).toMatchObject({
        template: { type: AUTOMATION_TEMPLATE_TYPES.BUILTIN, key: learnerTemplateKey },
      });

      for (const delivery of deliveries) await context.deliverAutomationEmail(delivery.id);

      const sentRecipients = context.adapter.getAllEmails().map(({ to }) => to);

      expect(sentRecipients.sort()).toEqual(expectedRecipients.sort());
    },
  );

  it("routes an occurrence queued before unification to the administrator workflow only", async () => {
    await context.runAsTenant(context.defaultTenantId, enableCourseCompletionAutomations);

    const legacyOccurrence = new NotificationEvent({
      occurrenceId: randomUUID(),
      kind: AUTOMATION_EVENT_KINDS.ADMIN_FINISHED_COURSE,
      recipients: [
        {
          itemId: context.admin.id,
          email: context.admin.email,
          language: SUPPORTED_LANGUAGES.EN,
          eventFields: LEGACY_ADMIN_COMPLETION_EVENT_FIELDS,
        },
      ],
    });

    const runs = await context.publishNotificationAndGetRuns(legacyOccurrence);
    const deliveries = await listTenantDeliveries();

    expect(runs).toHaveLength(1);
    expect(deliveries).toEqual([
      expect.objectContaining({
        recipientEmail: context.admin.email,
        template: {
          type: AUTOMATION_TEMPLATE_TYPES.BUILTIN,
          key: BUILT_IN_EMAIL_TEMPLATE_KEYS.ADMIN_FINISHED_COURSE,
        },
      }),
    ]);
    const adminAutomation = await context.runAsTenant(
      context.defaultTenantId,
      findAdminCourseCompletionAutomation,
    );

    expect(runs[0]?.automationId).toBe(adminAutomation.id);
  });
});
