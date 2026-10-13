import { randomUUID } from "node:crypto";

import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { eq } from "drizzle-orm";

import { NotificationEvent } from "src/automation-execution/events/notification-event";
import { automationEmailDeliveries, groupUsers, settings, users } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createGroupFactory } from "../../../test/factory/group.factory";

import {
  createWelcomeAutomationDefinition,
  getFirstEmailStep,
  setupAutomationTestContext,
} from "./automation-test.helpers";

import type { AutomationTestContext } from "./automation-test.helpers";

describe("Automation recipient scenarios (e2e)", () => {
  let t: AutomationTestContext;
  beforeAll(async () => {
    t = await setupAutomationTestContext();
  });
  beforeEach(async () => {
    await t.resetAutomationTestState();
  });
  afterAll(async () => {
    await t?.closeAutomationTestContext();
    jest.restoreAllMocks();
  });

  const enableEveryoneAutomation = async () => {
    const definition = createWelcomeAutomationDefinition();
    getFirstEmailStep(definition).config.recipients = { type: "everyone" };
    return t.createEnabledAutomation(definition);
  };

  it("does not multiply an everyone audience by the source recipient count", async () => {
    await enableEveryoneAutomation();
    const event = t.createWelcomeNotificationEvent();
    event.recipients.push({ ...event.recipients[0], itemId: t.admin.id, email: t.admin.email });
    const [run] = await t.publishNotificationAndGetRuns(event);
    const detail = await t.getAutomationRun(run.id);
    expect(detail.deliveries.map(({ recipientEmail }) => recipientEmail).sort()).toEqual(
      [t.student.email, t.admin.email].sort(),
    );
    for (const delivery of detail.deliveries) await t.deliverAutomationEmail(delivery.id);
    expect(t.adapter.getAllEmails()).toHaveLength(2);
    expect((await t.getAutomationRun(run.id)).run.succeededCount).toBe(2);
  });

  it("preserves distinct repeated source items even when their content and recipient match", async () => {
    await enableEveryoneAutomation();
    const event = t.createWelcomeNotificationEvent();
    event.recipients.push({ ...event.recipients[0], itemId: randomUUID() });
    const [run] = await t.publishNotificationAndGetRuns(event);
    const { deliveries } = await t.getAutomationRun(run.id);
    expect(deliveries).toHaveLength(4);
    for (const email of [t.student.email, t.admin.email]) {
      const selected = deliveries.filter(({ recipientEmail }) => recipientEmail === email);
      expect(selected).toHaveLength(2);
      expect(new Set(selected.map(({ recipientItemId }) => recipientItemId)).size).toBe(2);
    }
    for (const delivery of deliveries) await t.deliverAutomationEmail(delivery.id);
    expect(t.adapter.getAllEmails()).toHaveLength(4);
  });

  it("deduplicates explicit item IDs and expands items without event-linked recipients", async () => {
    await enableEveryoneAutomation();
    const base = t.createWelcomeNotificationEvent();
    const item = { itemId: randomUUID(), eventFields: base.recipients[0].eventFields };
    const event = new NotificationEvent(
      base.occurrenceId,
      base.kind,
      [],
      [item, structuredClone(item)],
    );
    const [run] = await t.publishNotificationAndGetRuns(event);
    const { deliveries } = await t.getAutomationRun(run.id);
    expect(deliveries).toHaveLength(2);
    for (const delivery of deliveries) await t.deliverAutomationEmail(delivery.id);
    expect((await t.getAutomationRun(run.id)).run).toMatchObject({
      status: "succeeded",
      succeededCount: 2,
    });
  });

  it("keeps overlapping event and everyone selections ordered for the same recipient", async () => {
    const definition = createWelcomeAutomationDefinition();
    const first = getFirstEmailStep(definition);
    definition.workflow.steps.push({
      ...structuredClone(first),
      id: randomUUID(),
      parentId: first.id,
      config: { ...first.config, recipients: { type: "everyone" } },
    });
    await t.createEnabledAutomation(definition);
    const [run] = await t.publishNotificationAndGetRuns();
    const { deliveries } = await t.getAutomationRun(run.id);
    expect(deliveries).toHaveLength(3);
    const student = deliveries
      .filter(({ recipientEmail }) => recipientEmail === t.student.email)
      .sort((a, b) => a.stepOrder - b.stepOrder);
    expect(student).toHaveLength(2);
    expect(student[0].recipientItemId).toBe(student[1].recipientItemId);
    await t.deliverAutomationEmail(student[1].id);
    expect(t.adapter.getAllEmails()).toEqual([]);
    await t.deliverAutomationEmail(
      deliveries.find(({ recipientEmail }) => recipientEmail === t.admin.email)!.id,
    );
    await t.deliverAutomationEmail(student[0].id);
    await t.deliverAutomationEmail(student[1].id);
    expect((await t.getAutomationRun(run.id)).run).toMatchObject({
      status: "succeeded",
      succeededCount: 3,
    });
  });

  it("snapshots group members per occurrence while using current membership for new events", async () => {
    const group = await t.runAsTenant(t.defaultTenantId, () =>
      createGroupFactory(t.db).withMembers([t.student.id]).create(),
    );
    const definition = createWelcomeAutomationDefinition();
    getFirstEmailStep(definition).config.recipients = { type: "group", groupId: group.id };
    await t.createEnabledAutomation(definition);
    const [before] = await t.publishNotificationAndGetRuns();
    await t.runAsTenant(t.defaultTenantId, async () => {
      await t.db.delete(groupUsers).where(eq(groupUsers.groupId, group.id));
      await t.db.insert(groupUsers).values({ groupId: group.id, userId: t.admin.id });
    });
    const [after] = await t.publishNotificationAndGetRuns();
    const oldDelivery = (await t.getAutomationRun(before.id)).deliveries[0];
    const newDelivery = (await t.getAutomationRun(after.id)).deliveries[0];
    expect(oldDelivery.recipientEmail).toBe(t.student.email);
    expect(newDelivery.recipientEmail).toBe(t.admin.email);
    await t.deliverAutomationEmail(oldDelivery.id);
    await t.deliverAutomationEmail(newDelivery.id);
    expect(t.adapter.getAllEmails().map(({ to }) => to)).toEqual([t.student.email, t.admin.email]);
  });

  it("completes an empty selected group without falling back to event recipients", async () => {
    const group = await t.runAsTenant(t.defaultTenantId, () => createGroupFactory(t.db).create());
    const definition = createWelcomeAutomationDefinition();
    getFirstEmailStep(definition).config.recipients = { type: "group", groupId: group.id };
    await t.createEnabledAutomation(definition);
    const [run] = await t.publishNotificationAndGetRuns();
    expect(await t.getAutomationRun(run.id)).toMatchObject({
      run: { status: "succeeded", succeededCount: 0 },
      deliveries: [],
    });
    expect(t.adapter.getAllEmails()).toEqual([]);
  });

  it.each(["deleted", "blank-email"])(
    "excludes %s users from a selected audience",
    async (scenario) => {
      await enableEveryoneAutomation();
      await t.runAsTenant(t.defaultTenantId, () =>
        t.db
          .update(users)
          .set(scenario === "deleted" ? { deletedAt: new Date().toISOString() } : { email: "" })
          .where(eq(users.id, t.student.id)),
      );
      try {
        const [run] = await t.publishNotificationAndGetRuns();
        expect(
          (await t.getAutomationRun(run.id)).deliveries.map(({ recipientEmail }) => recipientEmail),
        ).toEqual([t.admin.email]);
      } finally {
        await t.runAsTenant(t.defaultTenantId, () =>
          t.db
            .update(users)
            .set({ deletedAt: null, email: t.student.email })
            .where(eq(users.id, t.student.id)),
        );
      }
    },
  );

  it.each([SUPPORTED_LANGUAGES.PL, "unsupported"])(
    "resolves selected recipient language %s independently of source language",
    async (language) => {
      const previous = await t.runAsTenant(t.defaultTenantId, async () => {
        const [record] = await t.db
          .select()
          .from(settings)
          .where(eq(settings.userId, t.student.id));
        await t.db
          .update(settings)
          .set({
            settings: settingsToJSONBuildObject({ ...record.settings, language }),
          })
          .where(eq(settings.id, record.id));
        return record;
      });
      try {
        const definition = createWelcomeAutomationDefinition();
        getFirstEmailStep(definition).config.recipients = { type: "user", userId: t.student.id };
        await t.createEnabledAutomation(definition);
        const [run] = await t.publishNotificationAndGetRuns();
        const delivery = (await t.getAutomationRun(run.id)).deliveries[0];
        const expectedLanguage = language === "unsupported" ? SUPPORTED_LANGUAGES.EN : language;
        expect(delivery.language).toBe(expectedLanguage);
        await t.deliverAutomationEmail(delivery.id);
        expect((await t.getAutomationRun(run.id)).deliveries[0]).toMatchObject({
          status: "succeeded",
          language: expectedLanguage,
        });
      } finally {
        await t.runAsTenant(t.defaultTenantId, () =>
          t.db
            .update(settings)
            .set({ settings: settingsToJSONBuildObject(previous.settings) })
            .where(eq(settings.id, previous.id)),
        );
      }
    },
  );

  it("uses destination identity for announcement audiences and preserves source identity for learner events", async () => {
    for (const kind of ["announcement", "welcome"] as const) {
      const definition = createWelcomeAutomationDefinition();
      const trigger = definition.workflow.steps[0];
      if (trigger.type === "trigger") trigger.config.eventKind = kind;
      const action = getFirstEmailStep(definition);
      action.config.recipients = { type: "user", userId: t.admin.id };
      action.config.mappings = {
        courses_link: { type: "static", value: "https://academy.example" },
      };
      const automation = await t.createEnabledAutomation(definition);
      const base = t.createWelcomeNotificationEvent();
      base.recipients[0].eventFields = {
        userFirstName: "Source learner",
        userEmail: t.student.email,
      };
      const [run] = await t.publishNotificationAndGetRuns(
        new NotificationEvent(base.occurrenceId, kind, base.recipients),
      );
      const [delivery] = await t.runAsTenant(t.defaultTenantId, () =>
        t.db
          .select()
          .from(automationEmailDeliveries)
          .where(eq(automationEmailDeliveries.runId, run.id)),
      );
      expect(delivery.recipientEmail).toBe(t.admin.email);
      expect(delivery.eventFields).toMatchObject(
        kind === "announcement"
          ? { userFirstName: t.admin.firstName, userEmail: t.admin.email }
          : { userFirstName: "Source learner", userEmail: t.student.email },
      );
      await t.deliverAutomationEmail(delivery.id);
      await t.requestAutomationApi("post", `/${automation.id}/disable`).expect(201);
    }
    expect(t.adapter.getAllEmails()).toHaveLength(2);
  });
});
