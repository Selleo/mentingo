import { randomUUID } from "node:crypto";

import { AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS } from "@repo/shared";
import { eq } from "drizzle-orm";

import { AUTOMATION_INTERRUPTED_DELIVERY_TIMEOUT_MS } from "src/automation-execution/automation-execution.constants";
import { AutomationEmailDeliveryStateService } from "src/automation-execution/services/automation-email-delivery-state.service";
import { AutomationRecoveryAndCleanupService } from "src/automation-execution/services/automation-recovery-and-cleanup.service";
import { automationEmailDeliveries } from "src/storage/schema";

import {
  createWelcomeAutomationDefinition,
  getFirstEmailStep,
  setupAutomationTestContext,
} from "./automation-test.helpers";

import type { AutomationTestContext } from "./automation-test.helpers";

describe("Automation delivery races and recovery (e2e)", () => {
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

  const startSequentialEmailRun = async () => {
    const definition = createWelcomeAutomationDefinition();
    const first = getFirstEmailStep(definition);
    definition.workflow.steps.push({
      ...structuredClone(first),
      id: randomUUID(),
      parentId: first.id,
    });
    const automation = await t.createEnabledAutomation(definition);
    const [run] = await t.publishNotificationAndGetRuns();
    const { deliveries } = await t.getAutomationRun(run.id);
    deliveries.sort((a, b) => a.stepOrder - b.stepOrder);
    expect(deliveries).toHaveLength(2);
    return { automation, run, first: deliveries[0], next: deliveries[1] };
  };
  const recoverInterruptedDeliveries = () =>
    t.app.get(AutomationRecoveryAndCleanupService).recoverInterruptedAutomationDeliveries();
  const claimDelivery = (id: string) =>
    t.runAsTenant(t.defaultTenantId, () =>
      t.app.get(AutomationEmailDeliveryStateService).claimAutomationEmailDelivery(id),
    );
  const ageDeliveryClaim = (id: string, attemptCount = 1) =>
    t.runAsTenant(t.defaultTenantId, () =>
      t.db
        .update(automationEmailDeliveries)
        .set({
          claimedAt: new Date(
            Date.now() - AUTOMATION_INTERRUPTED_DELIVERY_TIMEOUT_MS - 60000,
          ).toISOString(),
          attemptCount,
        })
        .where(eq(automationEmailDeliveries.id, id)),
    );

  describe.each(["disable", "archive", "apply", "delete"] as const)(
    "%s during transport",
    (operation) => {
      it.each(["success", "failure"])(
        "handles provider %s without sending the successor",
        async (outcome) => {
          const { automation, run, first, next } = await startSequentialEmailRun();
          const sendMail = t.adapter.sendMail.bind(t.adapter);
          const send = jest.spyOn(t.adapter, "sendMail").mockImplementationOnce(async (email) => {
            // Change lifecycle after the real delivery claim, while transport is in flight.
            if (operation === "delete")
              await t.requestAutomationApi("delete", `/${automation.id}`).expect(200);
            else await t.requestAutomationApi("post", `/${automation.id}/${operation}`).expect(201);
            if (outcome === "failure") throw new Error("Provider failed after lifecycle change");
            await sendMail(email);
          });
          try {
            await t.deliverAutomationEmail(first.id);
            await t.deliverAutomationEmail(next.id);
            const detail = await t.getAutomationRun(run.id);
            expect(detail.run).toMatchObject({
              status: outcome === "success" ? "warnings" : "cancelled",
              succeededCount: outcome === "success" ? 1 : 0,
              cancelledCount: outcome === "success" ? 1 : 2,
              failedCount: 0,
            });
            expect(detail.deliveries.find(({ id }) => id === first.id)).toMatchObject({
              status: outcome === "success" ? "succeeded" : "cancelled",
              attemptCount: 1,
            });
            expect(detail.deliveries.find(({ id }) => id === next.id)).toMatchObject({
              status: "cancelled",
              attemptCount: 0,
            });
            expect(send).toHaveBeenCalledTimes(1);
            expect(t.adapter.getAllEmails()).toHaveLength(outcome === "success" ? 1 : 0);
            const persisted = await t.runAsTenant(t.defaultTenantId, () =>
              t.db
                .select()
                .from(automationEmailDeliveries)
                .where(eq(automationEmailDeliveries.runId, run.id)),
            );
            expect(persisted.every(({ eventFields }) => eventFields === null)).toBe(true);
          } finally {
            send.mockRestore();
          }
        },
      );
    },
  );

  it("continues the sequence after a terminal email failure and records a warning", async () => {
    const { run, first, next } = await startSequentialEmailRun();
    const send = jest
      .spyOn(t.adapter, "sendMail")
      .mockRejectedValue(new Error("Provider unavailable"));
    try {
      for (let attempt = 1; attempt < AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS; attempt++) {
        await expect(t.deliverAutomationEmail(first.id)).rejects.toThrow("retry requested");
        await t.deliverAutomationEmail(next.id);
        expect(send).toHaveBeenCalledTimes(attempt);
      }
      await t.deliverAutomationEmail(first.id);
    } finally {
      send.mockRestore();
    }
    expect(await t.queue.getJob(`automation-email-${next.id}`)).toBeTruthy();
    await t.deliverAutomationEmail(next.id);
    expect((await t.getAutomationRun(run.id)).run).toMatchObject({
      status: "warnings",
      failedCount: 1,
      succeededCount: 1,
    });
    expect(t.adapter.getAllEmails()).toHaveLength(1);
  });

  it("does not recover a fresh processing claim or queue its successor", async () => {
    const { run, first, next } = await startSequentialEmailRun();
    await claimDelivery(first.id);
    await recoverInterruptedDeliveries();
    const detail = await t.getAutomationRun(run.id);
    expect(detail.deliveries.find(({ id }) => id === first.id)).toMatchObject({
      status: "processing",
      attemptCount: 1,
    });
    expect(detail.deliveries.find(({ id }) => id === next.id)).toMatchObject({
      status: "pending",
      attemptCount: 0,
    });
    expect(await t.queue.getJob(`automation-email-${next.id}`)).toBeUndefined();
    expect(t.adapter.getAllEmails()).toEqual([]);
  });

  it("recreates a lost queue job only for the earliest unfinished action", async () => {
    const { run, first, next } = await startSequentialEmailRun();
    await t.queue.drain(true);
    expect(await t.queue.getJob(`automation-email-${first.id}`)).toBeUndefined();
    await recoverInterruptedDeliveries();
    await recoverInterruptedDeliveries();
    expect(await t.queue.getJob(`automation-email-${first.id}`)).toBeTruthy();
    expect(await t.queue.getJob(`automation-email-${next.id}`)).toBeUndefined();
    expect(await t.queue.getWaitingCount()).toBe(1);
    await t.deliverAutomationEmail(first.id);
    await t.deliverAutomationEmail(next.id);
    expect((await t.getAutomationRun(run.id)).run.status).toBe("succeeded");
  });

  it("fails an exhausted stale claim and allows its successor to finish", async () => {
    const { run, first, next } = await startSequentialEmailRun();
    await claimDelivery(first.id);
    await ageDeliveryClaim(first.id, AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS);
    await recoverInterruptedDeliveries();
    expect(
      (await t.getAutomationRun(run.id)).deliveries.find(({ id }) => id === first.id),
    ).toMatchObject({
      status: "failed",
      reasonCode: "interrupted_delivery",
      attemptCount: AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS,
    });
    expect(await t.queue.getJob(`automation-email-${next.id}`)).toBeTruthy();
    await t.deliverAutomationEmail(first.id);
    expect(t.adapter.getAllEmails()).toEqual([]);
    await t.deliverAutomationEmail(next.id);
    expect((await t.getAutomationRun(run.id)).run).toMatchObject({
      status: "warnings",
      succeededCount: 1,
      failedCount: 1,
    });
  });

  it("cancels a stale processing claim after its applied definition changes", async () => {
    const { automation, run, first, next } = await startSequentialEmailRun();
    await claimDelivery(first.id);
    await t.requestAutomationApi("post", `/${automation.id}/apply`).expect(201);
    await ageDeliveryClaim(first.id);
    await recoverInterruptedDeliveries();
    const detail = await t.getAutomationRun(run.id);
    expect(detail.run).toMatchObject({ status: "cancelled", cancelledCount: 2 });
    expect(detail.deliveries.find(({ id }) => id === first.id)).toMatchObject({
      status: "cancelled",
      reasonCode: "live_definition_changed",
    });
    await t.deliverAutomationEmail(first.id);
    await t.deliverAutomationEmail(next.id);
    expect(t.adapter.getAllEmails()).toEqual([]);
  });
});
