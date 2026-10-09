import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { hashToken } from "src/auth/utils/hash-auth-token";
import { NotificationEvent } from "src/automation-execution/events/notification-event";
import { NotificationAccountActionService } from "src/automation-execution/services/notification-account-action.service";
import { notificationAccountActionIntents, resetTokens } from "src/storage/schema";

import { setupAutomationTestContext } from "./automation-test.helpers";

import type { AutomationTestContext } from "./automation-test.helpers";
import type { AutomationWorkflowTemplateResponse } from "../schema/automation.schema";

describe("Automation account-action delivery (e2e)", () => {
  let t: AutomationTestContext;
  const originalKey = process.env.MASTER_KEY;
  beforeAll(async () => {
    process.env.MASTER_KEY = randomBytes(32).toString("base64");
    t = await setupAutomationTestContext();
  });
  beforeEach(async () => {
    await t.resetAutomationTestState();
    await t.runAsTenant(t.defaultTenantId, async () => {
      await t.db.delete(notificationAccountActionIntents);
      await t.db.delete(resetTokens);
    });
  });
  afterAll(async () => {
    try {
      await t?.closeAutomationTestContext();
    } finally {
      if (originalKey === undefined) delete process.env.MASTER_KEY;
      else process.env.MASTER_KEY = originalKey;
      jest.restoreAllMocks();
    }
  });
  const start = async () => {
    const catalog = (await t.requestAutomationApi("get", "/workflow-templates").expect(200)).body
      .data as AutomationWorkflowTemplateResponse[];
    await t.createEnabledAutomation(
      catalog.find(({ key }) => key === "password_recovery")!.definition,
    );
    const intent = await t.runAsTenant(t.defaultTenantId, () =>
      t.app.get(NotificationAccountActionService).createNotificationAccountActionIntent({
        kind: "reset_password",
        userId: t.student.id,
        applicationOrigin: "https://academy.example",
        tokenTtlMs: 60000,
      }),
    );
    const base = t.createWelcomeNotificationEvent();
    const event = new NotificationEvent(base.occurrenceId, "password_recovery", [
      {
        ...base.recipients[0],
        accountActionIntentId: intent,
        eventFields: { name: "Recovery learner" },
      },
    ]);
    const [run] = await t.publishNotificationAndGetRuns(event);
    const delivery = (await t.getAutomationRun(run.id)).deliveries[0];
    return { run, delivery, intent };
  };
  const intents = () =>
    t.runAsTenant(t.defaultTenantId, () => t.db.select().from(notificationAccountActionIntents));
  const tokens = () => t.runAsTenant(t.defaultTenantId, () => t.db.select().from(resetTokens));

  it("creates credentials only during delivery and never exposes token material in history", async () => {
    const { run, delivery } = await start();
    expect(await tokens()).toEqual([]);
    expect((await intents())[0].encryptedToken).toBeNull();
    await t.deliverAutomationEmail(delivery.id);
    const email = t.adapter.getLastEmail()!;
    expect(email.html).toContain("https://academy.example");
    const match = email.html!.match(/resetToken=([^"&<\s]+)/);
    expect(match).not.toBeNull();
    const token = decodeURIComponent(match![1]);
    expect((await tokens())[0].tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(await intents())).not.toContain(token);
    expect(JSON.stringify(await t.getAutomationRun(run.id))).not.toContain(token);
    expect((await t.getAutomationRun(run.id)).run.status).toBe("succeeded");
  });

  it("reuses the same credential after a transport failure", async () => {
    const { delivery } = await start();
    const send = jest
      .spyOn(t.adapter, "sendMail")
      .mockRejectedValueOnce(new Error("Transport interrupted"));
    try {
      await expect(t.deliverAutomationEmail(delivery.id)).rejects.toThrow("retry requested");
      const firstTokens = await tokens();
      const firstHtml = send.mock.calls[0][0].html;
      expect(firstTokens).toHaveLength(1);
      await t.deliverAutomationEmail(delivery.id);
      expect(await tokens()).toEqual(firstTokens);
      expect(send.mock.calls[1][0].html).toBe(firstHtml);
    } finally {
      send.mockRestore();
    }
  });

  it.each(["expired", "missing", "wrong-recipient"])(
    "skips %s intents without producing credentials",
    async (scenario) => {
      const { run, delivery, intent } = await start();
      await t.runAsTenant(t.defaultTenantId, async () => {
        if (scenario === "expired")
          await t.db
            .update(notificationAccountActionIntents)
            .set({ createdAt: new Date(Date.now() - 120000).toISOString() })
            .where(eq(notificationAccountActionIntents.id, intent));
        if (scenario === "missing")
          await t.db
            .delete(notificationAccountActionIntents)
            .where(eq(notificationAccountActionIntents.id, intent));
        if (scenario === "wrong-recipient")
          await t.db
            .update(notificationAccountActionIntents)
            .set({ userId: t.admin.id })
            .where(eq(notificationAccountActionIntents.id, intent));
      });
      await t.deliverAutomationEmail(delivery.id);
      expect(await t.getAutomationRun(run.id)).toMatchObject({
        run: { status: "warnings" },
        deliveries: [
          expect.objectContaining({
            status: "skipped",
            reasonCode: "account_action_expired_or_revoked",
          }),
        ],
      });
      expect(await tokens()).toEqual([]);
      expect(t.adapter.getAllEmails()).toEqual([]);
    },
  );

  it("does not regenerate a revoked credential on retry", async () => {
    const { run, delivery } = await start();
    const send = jest
      .spyOn(t.adapter, "sendMail")
      .mockRejectedValueOnce(new Error("Transport interrupted"));
    try {
      await expect(t.deliverAutomationEmail(delivery.id)).rejects.toThrow("retry requested");
      await t.runAsTenant(t.defaultTenantId, () => t.db.delete(resetTokens));
      await t.deliverAutomationEmail(delivery.id);
      expect((await t.getAutomationRun(run.id)).deliveries[0].status).toBe("skipped");
      expect(await tokens()).toEqual([]);
      expect(t.adapter.getAllEmails()).toEqual([]);
    } finally {
      send.mockRestore();
    }
  });
});
