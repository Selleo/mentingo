import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { NotificationEvent } from "src/automation-execution/events/notification-event";
import { AutomationEmailDeliveryService } from "src/automation-execution/services/automation-email-delivery.service";
import { AutomationEmailWorker } from "src/automation-execution/workers/automation-email.worker";
import { QueueService, QUEUE_NAMES } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  createWelcomeAutomationDefinition,
  setupAutomationTestContext,
} from "./automation-test.helpers";

import type { AutomationTestContext } from "./automation-test.helpers";

async function runWorker(t: AutomationTestContext, ids: string[]) {
  const events = t.app.get(QueueService).getQueueEvents(QUEUE_NAMES.AUTOMATION_EMAIL);
  await events.waitUntilReady();
  const pending = new Set(ids.map((id) => `automation-email-${id}`));
  const worker = new AutomationEmailWorker(
    t.app.get(QueueService),
    t.app.get(TenantDbRunnerService),
    t.app.get(AutomationEmailDeliveryService),
  );
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let completed: (event: { jobId: string }) => void = () => {};
  let failed: (event: { jobId: string; failedReason: string }) => void = () => {};
  try {
    await new Promise<void>((resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error(`Automation jobs did not complete: ${[...pending].join(", ")}`)),
        15000,
      );
      completed = ({ jobId }) => {
        pending.delete(jobId);
        if (pending.size === 0) resolve();
      };
      failed = ({ jobId, failedReason }) => {
        if (pending.has(jobId)) reject(new Error(failedReason));
      };
      events.on("completed", completed);
      events.on("failed", failed);
      worker.onApplicationBootstrap();
    });
  } finally {
    clearTimeout(timeout);
    events.off("completed", completed);
    events.off("failed", failed);
    await worker.onModuleDestroy();
  }
}

describe("Automation BullMQ worker (e2e)", () => {
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

  it("runs the same occurrence independently in two tenants and preserves recipient language", async () => {
    await t.createEnabledAutomation();
    const other = (
      await t
        .requestAutomationApi("post", "", t.otherCookie, t.otherTenant.host)
        .send(createWelcomeAutomationDefinition())
        .expect(201)
    ).body.data;
    await t
      .requestAutomationApi("post", `/${other.id}/enable`, t.otherCookie, t.otherTenant.host)
      .expect(201);
    const first = t.createWelcomeNotificationEvent();
    const second = new NotificationEvent(
      first.occurrenceId,
      first.kind,
      structuredClone(first.recipients),
    );
    second.recipients[0] = {
      ...second.recipients[0],
      itemId: t.otherAdmin.id,
      email: t.otherAdmin.email,
      language: SUPPORTED_LANGUAGES.PL,
    };
    const [run] = await t.publishNotificationAndGetRuns(first);
    const [otherRun] = await t.publishNotificationAndGetRuns(second, t.otherTenant.id);
    const deliveries = (await t.getAutomationRun(run.id)).deliveries;
    const otherDeliveries = (
      await t
        .requestAutomationApi(
          "get",
          `/automation-runs/${otherRun.id}`,
          t.otherCookie,
          t.otherTenant.host,
        )
        .expect(200)
    ).body.data.deliveries;
    await runWorker(t, [deliveries[0].id, otherDeliveries[0].id]);
    expect(
      t.adapter
        .getAllEmails()
        .map(({ to }) => to)
        .sort(),
    ).toEqual([t.student.email, t.otherAdmin.email].sort());
    expect((await t.getAutomationRun(run.id)).run.status).toBe("succeeded");
    const otherResult = (
      await t
        .requestAutomationApi(
          "get",
          `/automation-runs/${otherRun.id}`,
          t.otherCookie,
          t.otherTenant.host,
        )
        .expect(200)
    ).body.data;
    expect(otherResult.run.status).toBe("succeeded");
    expect(otherResult.deliveries[0].language).toBe(SUPPORTED_LANGUAGES.PL);
    const subjects = t.adapter.getAllEmails().map(({ subject }) => subject);
    expect(new Set(subjects).size).toBe(2);
  });

  it("lets BullMQ retry a transient adapter error and complete the persisted delivery", async () => {
    await t.createEnabledAutomation();
    const [run] = await t.publishNotificationAndGetRuns();
    const delivery = (await t.getAutomationRun(run.id)).deliveries[0];
    const send = jest
      .spyOn(t.adapter, "sendMail")
      .mockRejectedValueOnce(new Error("Transient provider error"));
    try {
      await runWorker(t, [delivery.id]);
      expect((await t.getAutomationRun(run.id)).deliveries[0]).toMatchObject({
        status: "succeeded",
        attemptCount: 2,
      });
      expect(t.adapter.getAllEmails()).toHaveLength(1);
    } finally {
      send.mockRestore();
    }
  });
});
