import { randomUUID } from "node:crypto";

import { AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq } from "drizzle-orm";

import { NotificationEvent } from "src/automation-execution/events/notification-event";
import { AutomationEmailDeliveryStateService } from "src/automation-execution/services/automation-email-delivery-state.service";
import { AutomationRecoveryAndCleanupService } from "src/automation-execution/services/automation-recovery-and-cleanup.service";
import {
  automationEmailDeliveries,
  automationRuns,
  permissionRoles,
  users,
} from "src/storage/schema";

import { createGroupFactory } from "../../../test/factory/group.factory";

import {
  createWelcomeAutomationDefinition,
  getFirstEmailStep,
  setupAutomationTestContext,
} from "./automation-test.helpers";

import type { AutomationTestContext } from "./automation-test.helpers";

describe("Automation event-to-delivery execution (e2e)", () => {
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

  const start = async (body = createWelcomeAutomationDefinition()) => {
    const automation = await t.createEnabledAutomation(body);
    const [run] = await t.publishNotificationAndGetRuns();
    expect(run.automationId).toBe(automation.id);
    const detail = await t.getAutomationRun(run.id);
    return { automation, run, deliveries: detail.deliveries };
  };
  const storedDeliveries = () =>
    t.runAsTenant(t.defaultTenantId, () =>
      t.db.select().from(automationEmailDeliveries).orderBy(automationEmailDeliveries.stepOrder),
    );

  it("delivers rendered content once, exposes history, and scrubs completed payloads", async () => {
    const { automation, run, deliveries } = await start();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({
      status: "pending",
      attemptCount: 0,
      recipientEmail: t.student.email,
    });
    await Promise.all([
      t.deliverAutomationEmail(deliveries[0].id),
      t.deliverAutomationEmail(deliveries[0].id),
    ]);
    await t.deliverAutomationEmail(deliveries[0].id);
    expect(t.adapter.getAllEmails()).toHaveLength(1);
    expect(t.adapter.getLastEmail()).toMatchObject({
      to: t.student.email,
      html: expect.stringContaining("https://academy.example/courses"),
    });
    expect((await t.getAutomationRun(run.id)).run).toMatchObject({
      status: "succeeded",
      succeededCount: 1,
      failedCount: 0,
      cancelledCount: 0,
      automationName: automation.name,
      completedAt: expect.any(String),
    });
    expect((await storedDeliveries())[0]).toMatchObject({
      eventFields: null,
      accountActionIntentId: null,
      attemptCount: 1,
    });
    const history = (
      await t
        .requestAutomationApi(
          "get",
          `/automation-runs?automationId=${
            automation.id
          }&status=succeeded&search=${encodeURIComponent(t.student.email)}`,
        )
        .expect(200)
    ).body.data;
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(run.id);
    expect(JSON.stringify(await t.getAutomationRun(run.id))).not.toContain("eventFields");
    expect(
      (await t.requestAutomationApi("get", "/automation-runs?status=failed").expect(200)).body.data,
    ).toEqual([]);
  });

  it("deduplicates concurrent occurrences but permits a new occurrence", async () => {
    await t.createEnabledAutomation();
    const event = t.createWelcomeNotificationEvent();
    await Promise.all([
      t.publishNotificationAndGetRuns(event),
      t.publishNotificationAndGetRuns(event),
    ]);
    await t.publishNotificationAndGetRuns(event);
    expect(await storedDeliveries()).toHaveLength(1);
    await t.publishNotificationAndGetRuns();
    expect(await storedDeliveries()).toHaveLength(2);
  });

  it("fans one occurrence out to multiple matching automations and ignores unmatched triggers", async () => {
    const first = await t.createEnabledAutomation();
    const second = await t.createEnabledAutomation({
      ...createWelcomeAutomationDefinition(),
      name: "Second automation",
    });
    const unmatched = createWelcomeAutomationDefinition();
    const trigger = unmatched.workflow.steps[0];
    if (trigger.type === "trigger") trigger.config.eventKind = "user_first_login";
    getFirstEmailStep(unmatched).config.mappings = {
      courses_link: { type: "static", value: "https://academy.example" },
    };
    await t.createEnabledAutomation(unmatched);
    const runs = await t.publishNotificationAndGetRuns();
    expect(new Set(runs.map(({ automationId }) => automationId))).toEqual(
      new Set([first.id, second.id]),
    );
    expect(await storedDeliveries()).toHaveLength(2);
  });

  it.each(["draft", "disabled", "archived", "deleted"])(
    "does not execute %s workflows",
    async (state) => {
      const automation = await t.createAutomation();
      if (state !== "draft")
        await t.requestAutomationApi("post", `/${automation.id}/enable`).expect(201);
      if (state === "disabled")
        await t.requestAutomationApi("post", `/${automation.id}/disable`).expect(201);
      if (state === "archived")
        await t.requestAutomationApi("post", `/${automation.id}/archive`).expect(201);
      if (state === "deleted")
        await t.requestAutomationApi("delete", `/${automation.id}`).expect(200);
      expect(await t.publishNotificationAndGetRuns()).toEqual([]);
      expect(await storedDeliveries()).toEqual([]);
    },
  );

  it("continues using the applied workflow after draft edits", async () => {
    const { automation, deliveries } = await start();
    await t
      .requestAutomationApi("patch", `/${automation.id}`)
      .send({ workflow: { rootStepId: null, steps: [] }, name: "Unapplied" })
      .expect(200);
    await t.deliverAutomationEmail(deliveries[0].id);
    const [nextRun] = await t.publishNotificationAndGetRuns();
    expect(nextRun.automationName).toBe(automation.name);
    const next = await t.getAutomationRun(nextRun.id);
    await t.deliverAutomationEmail(next.deliveries[0].id);
    expect(t.adapter.getAllEmails()).toHaveLength(2);
  });

  it.each(["disable", "archive", "apply", "delete"])(
    "cancels queued deliveries after %s while retaining run history",
    async (operation) => {
      const { automation, run, deliveries } = await start();
      if (operation === "delete")
        await t.requestAutomationApi("delete", `/${automation.id}`).expect(200);
      else await t.requestAutomationApi("post", `/${automation.id}/${operation}`).expect(201);
      await t.deliverAutomationEmail(deliveries[0].id);
      const detail = await t.getAutomationRun(run.id);
      expect(detail.run).toMatchObject({ status: "cancelled", cancelledCount: 1 });
      expect(detail.deliveries[0]).toMatchObject({ status: "cancelled", attemptCount: 0 });
      expect(t.adapter.getAllEmails()).toEqual([]);
      expect((await storedDeliveries())[0].eventFields).toBeNull();
    },
  );

  it("processes sequential emails in order and only queues the first action initially", async () => {
    const body = createWelcomeAutomationDefinition();
    const first = getFirstEmailStep(body);
    body.workflow.steps.push({ ...structuredClone(first), id: randomUUID(), parentId: first.id });
    const { run, deliveries } = await start(body);
    expect(deliveries).toHaveLength(2);
    const ordered = [...deliveries].sort((a, b) => a.stepOrder - b.stepOrder);
    expect(await t.queue.getJob(`automation-email-${ordered[0].id}`)).toBeTruthy();
    expect(await t.queue.getJob(`automation-email-${ordered[1].id}`)).toBeUndefined();
    await t.deliverAutomationEmail(ordered[1].id);
    expect(t.adapter.getAllEmails()).toEqual([]);
    await t.deliverAutomationEmail(ordered[0].id);
    expect((await t.getAutomationRun(run.id)).run.status).toBe("processing");
    expect(await t.queue.getJob(`automation-email-${ordered[1].id}`)).toBeTruthy();
    expect((await storedDeliveries())[0].eventFields).not.toBeNull();
    await t.deliverAutomationEmail(ordered[1].id);
    expect((await t.getAutomationRun(run.id)).run).toMatchObject({
      status: "succeeded",
      succeededCount: 2,
    });
    expect((await storedDeliveries()).every(({ eventFields }) => eventFields === null)).toBe(true);
    expect(t.adapter.getAllEmails()).toHaveLength(2);
  });

  it("retries transient transport failures and records only safe reason codes", async () => {
    const { run, deliveries } = await start();
    const send = jest
      .spyOn(t.adapter, "sendMail")
      .mockRejectedValueOnce(new Error("provider-secret-and-message-body"));
    try {
      await expect(t.deliverAutomationEmail(deliveries[0].id)).rejects.toThrow("retry requested");
      const retry = await t.getAutomationRun(run.id);
      expect(retry.deliveries[0]).toMatchObject({
        status: "retrying",
        attemptCount: 1,
        reasonCode: "email_action_failed",
        completedAt: null,
      });
      expect(JSON.stringify(retry)).not.toContain("provider-secret");
      await t.deliverAutomationEmail(deliveries[0].id);
      expect((await t.getAutomationRun(run.id)).deliveries[0]).toMatchObject({
        status: "succeeded",
        attemptCount: 2,
        reasonCode: null,
      });
      expect(t.adapter.getAllEmails()).toHaveLength(1);
    } finally {
      send.mockRestore();
    }
  });

  it("exhausts retries for one recipient while allowing another to succeed", async () => {
    await t.createEnabledAutomation();
    const event = t.createWelcomeNotificationEvent();
    event.recipients.push({ ...event.recipients[0], itemId: t.admin.id, email: t.admin.email });
    const [run] = await t.publishNotificationAndGetRuns(event);
    const deliveries = (await t.getAutomationRun(run.id)).deliveries;
    const failing = deliveries.find(({ recipientEmail }) => recipientEmail === t.student.email)!;
    const success = deliveries.find(({ recipientEmail }) => recipientEmail === t.admin.email)!;
    await t.deliverAutomationEmail(success.id);
    const send = jest.spyOn(t.adapter, "sendMail").mockRejectedValue(new Error("Unavailable"));
    try {
      for (let attempt = 1; attempt < AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS; attempt++)
        await expect(t.deliverAutomationEmail(failing.id)).rejects.toThrow("retry requested");
      await t.deliverAutomationEmail(failing.id);
      await t.deliverAutomationEmail(failing.id);
      expect(send).toHaveBeenCalledTimes(AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS);
      expect((await t.getAutomationRun(run.id)).run).toMatchObject({
        status: "warnings",
        succeededCount: 1,
        failedCount: 1,
        failureReasonCode: "email_action_failed",
      });
      expect((await storedDeliveries()).every(({ eventFields }) => eventFields === null)).toBe(
        true,
      );
    } finally {
      send.mockRestore();
    }
  });

  it.each(["event", "user", "group", "role", "everyone"] as const)(
    "resolves %s recipients within the current tenant",
    async (type) => {
      const body = createWelcomeAutomationDefinition();
      const selection = await t.runAsTenant(t.defaultTenantId, async () => {
        if (type === "group") {
          const group = await createGroupFactory(t.db).withMembers([t.student.id]).create();
          return { type, groupId: group.id };
        }
        if (type === "role") {
          const [role] = await t.db
            .select()
            .from(permissionRoles)
            .where(eq(permissionRoles.slug, SYSTEM_ROLE_SLUGS.STUDENT));
          return { type, roleId: role.id };
        }
        if (type === "user") return { type, userId: t.student.id };
        return { type };
      });
      getFirstEmailStep(body).config.recipients = selection;
      const { run, deliveries } = await start(body);
      const expected = type === "everyone" ? [t.admin.email, t.student.email] : [t.student.email];
      expect(deliveries.map(({ recipientEmail }) => recipientEmail).sort()).toEqual(
        expected.sort(),
      );
      for (const delivery of deliveries) await t.deliverAutomationEmail(delivery.id);
      expect((await t.getAutomationRun(run.id)).run.succeededCount).toBe(expected.length);
      expect(
        t.adapter
          .getAllEmails()
          .map(({ to }) => to)
          .sort(),
      ).toEqual(expected.sort());
    },
  );

  it("re-evaluates recipient eligibility when the event arrives", async () => {
    const body = createWelcomeAutomationDefinition();
    getFirstEmailStep(body).config.recipients = { type: "everyone" };
    await t.createEnabledAutomation(body);
    await t.runAsTenant(t.defaultTenantId, () =>
      t.db.update(users).set({ archived: true }).where(eq(users.id, t.student.id)),
    );
    try {
      const [run] = await t.publishNotificationAndGetRuns();
      expect(
        (await t.getAutomationRun(run.id)).deliveries.map(({ recipientEmail }) => recipientEmail),
      ).toEqual([t.admin.email]);
    } finally {
      await t.runAsTenant(t.defaultTenantId, () =>
        t.db.update(users).set({ archived: false }).where(eq(users.id, t.student.id)),
      );
    }
  });

  it("records an empty audience as completed without sending", async () => {
    await t.createEnabledAutomation();
    const event = t.createWelcomeNotificationEvent();
    event.recipients.length = 0;
    const [run] = await t.publishNotificationAndGetRuns(event);
    expect(await t.getAutomationRun(run.id)).toMatchObject({
      run: { status: "succeeded", succeededCount: 0, completedAt: expect.any(String) },
      deliveries: [],
    });
  });

  it("prevents foreign tenant delivery claims and history access", async () => {
    const { run, deliveries } = await start();
    await t.deliverAutomationEmail(deliveries[0].id, t.otherTenant.id);
    expect(t.adapter.getAllEmails()).toEqual([]);
    expect((await t.getAutomationRun(run.id)).deliveries[0].attemptCount).toBe(0);
    await t
      .requestAutomationApi("get", `/automation-runs/${run.id}`, t.otherCookie, t.otherTenant.host)
      .expect(404);
    expect(
      (
        await t
          .requestAutomationApi("get", "/automation-runs", t.otherCookie, t.otherTenant.host)
          .expect(200)
      ).body.data,
    ).toEqual([]);
    await t.requestAutomationApi("get", `/automation-runs/${randomUUID()}`).expect(404);
    await t.requestAutomationApi("get", "/automation-runs/bad-id").expect(400);
  });

  it("cancels old queued publications when a custom template is republished", async () => {
    const template = await t.createEmailTemplate();
    await t.requestEmailTemplateApi("post", `/${template.id}/publish`).expect(201);
    const body = createWelcomeAutomationDefinition();
    getFirstEmailStep(body).config.template = { type: "custom", id: template.id! };
    const { run, deliveries } = await start(body);
    await t
      .requestEmailTemplateApi("patch", `/${template.id}`)
      .send({ subject: { en: "New publication" } })
      .expect(200);
    await t.requestEmailTemplateApi("post", `/${template.id}/publish`).expect(201);
    await t.deliverAutomationEmail(deliveries[0].id);
    expect((await t.getAutomationRun(run.id)).deliveries[0]).toMatchObject({
      status: "cancelled",
      reasonCode: "template_republished",
    });
    expect(t.adapter.getAllEmails()).toEqual([]);
    const [next] = await t.publishNotificationAndGetRuns();
    await t.deliverAutomationEmail((await t.getAutomationRun(next.id)).deliveries[0].id);
    expect(t.adapter.getLastEmail()?.subject).toBe("New publication");
  });

  it("recovers stale claims, ignores late results, and delivers the recovered attempt", async () => {
    const { run, deliveries } = await start();
    const state = t.app.get(AutomationEmailDeliveryStateService);
    await t.runAsTenant(t.defaultTenantId, () =>
      state.claimAutomationEmailDelivery(deliveries[0].id),
    );
    await t.runAsTenant(t.defaultTenantId, () =>
      t.db
        .update(automationEmailDeliveries)
        .set({ claimedAt: new Date(Date.now() - 600000).toISOString() })
        .where(eq(automationEmailDeliveries.id, deliveries[0].id)),
    );
    await t.app.get(AutomationRecoveryAndCleanupService).recoverInterruptedAutomationDeliveries();
    expect((await t.getAutomationRun(run.id)).deliveries[0]).toMatchObject({
      status: "retrying",
      attemptCount: 1,
      reasonCode: "interrupted_delivery",
    });
    await t.runAsTenant(t.defaultTenantId, () =>
      state.recordAutomationEmailDeliveryResult(deliveries[0].id, "succeeded", null, undefined, 1),
    );
    expect((await t.getAutomationRun(run.id)).deliveries[0].status).toBe("retrying");
    await t.deliverAutomationEmail(deliveries[0].id);
    expect((await t.getAutomationRun(run.id)).deliveries[0]).toMatchObject({
      status: "succeeded",
      attemptCount: 2,
    });
  });

  it("retains active and recent history while purging old completed runs and deliveries", async () => {
    const { run, deliveries } = await start();
    await t.deliverAutomationEmail(deliveries[0].id);
    const [active] = await t.publishNotificationAndGetRuns();
    const [recent] = await t.publishNotificationAndGetRuns();
    await t.deliverAutomationEmail((await t.getAutomationRun(recent.id)).deliveries[0].id);
    await t.runAsTenant(t.defaultTenantId, () =>
      t.db
        .update(automationRuns)
        .set({ completedAt: new Date(Date.now() - 100 * 86400000).toISOString() })
        .where(eq(automationRuns.id, run.id)),
    );
    await t.app.get(AutomationRecoveryAndCleanupService).purgeExpiredAutomationRuns();
    await t.requestAutomationApi("get", `/automation-runs/${run.id}`).expect(404);
    expect((await t.getAutomationRun(active.id)).run.status).toBe("pending");
    expect((await t.getAutomationRun(recent.id)).run.status).toBe("succeeded");
    expect((await storedDeliveries()).some(({ runId }) => runId === run.id)).toBe(false);
  });
  it.each([true, false, "invalid"])(
    "evaluates runtime conditions for %s without sending the wrong branch",
    async (value) => {
      const body = createWelcomeAutomationDefinition();
      const trigger = body.workflow.steps[0];
      if (trigger.type === "trigger") trigger.config.eventKind = "user_assigned_to_course";
      const conditionId = randomUUID();
      const yes = getFirstEmailStep(body);
      yes.parentId = conditionId;
      yes.config.mappings = {
        courses_link: { type: "static", value: "https://academy.example/yes" },
      };
      const no = {
        ...structuredClone(yes),
        id: randomUUID(),
        position: 1,
        config: {
          ...yes.config,
          mappings: {
            courses_link: { type: "static" as const, value: "https://academy.example/no" },
          },
        },
      };
      body.workflow.steps.push(
        {
          id: conditionId,
          parentId: trigger.id,
          position: 0,
          type: "condition",
          config: { field: "has_deadline" },
        },
        no,
      );
      await t.createEnabledAutomation(body);
      const base = t.createWelcomeNotificationEvent();
      const event = new NotificationEvent(base.occurrenceId, "user_assigned_to_course", [
        { ...base.recipients[0], eventFields: { has_deadline: value } },
      ]);
      const [run] = await t.publishNotificationAndGetRuns(event);
      const detail = await t.getAutomationRun(run.id);
      if (value === "invalid") {
        expect(detail).toMatchObject({
          run: { status: "failed", failureReasonCode: "invalid_condition_value" },
          deliveries: [],
        });
        expect(t.adapter.getAllEmails()).toEqual([]);
      } else {
        expect(detail.deliveries).toHaveLength(1);
        expect(detail.deliveries[0].stepId).toBe(value ? yes.id : no.id);
        await t.deliverAutomationEmail(detail.deliveries[0].id);
        expect(t.adapter.getLastEmail()?.html).toContain(
          value ? "https://academy.example/yes" : "https://academy.example/no",
        );
        expect((await t.getAutomationRun(run.id)).run.status).toBe("succeeded");
      }
    },
  );
});
