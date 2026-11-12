import { Logger } from "@nestjs/common";

import { OutboxDispatcherService } from "./outbox-dispatcher.service";

class LessonProgressChangedEvent {}

describe("OutboxDispatcherService", () => {
  it("continues dispatching after a handler fails and releases its running guard", async () => {
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const event = {
      id: "failed",
      tenantId: "tenant",
      eventType: LessonProgressChangedEvent.name,
      payload: { data: { userId: "learner", courseId: "course" } },
      attemptCount: 0,
      succeededHandlers: [],
      claimId: "claim",
    };
    const outboxRepository = {
      releaseStalledClaims: jest.fn(),
      claimNextDueEvent: jest
        .fn()
        .mockResolvedValueOnce(event)
        .mockResolvedValueOnce({ ...event, id: "ready" })
        .mockResolvedValue(null),
      recordFailedAttempt: jest.fn(),
      refreshClaim: jest.fn(),
      markPublished: jest.fn(),
      recordSucceededHandler: jest.fn(),
      replaceStoredPayload: jest.fn(),
      lockClaimedEvent: jest.fn().mockResolvedValue({ succeededHandlers: [] }),
    };
    const handleOutboxEvent = jest
      .fn()
      .mockRejectedValueOnce(new Error("Redis unavailable"))
      .mockResolvedValue(undefined);
    const outboxEventHandlerRegistry = {
      findEventSubscription: jest.fn().mockReturnValue({
        eventClass: LessonProgressChangedEvent,
        handlers: [{ name: "CompetenciesLearningHandler", handleOutboxEvent }],
      }),
      getEventOptions: jest.fn().mockReturnValue({}),
    };
    const tenantDbRunnerService = {
      runForEachTenant: jest.fn(async (callback) => callback("tenant")),
      transactionWithHandle: jest.fn(async (callback) => callback()),
    };
    const dispatcher = new OutboxDispatcherService(
      tenantDbRunnerService as never,
      outboxRepository as never,
      outboxEventHandlerRegistry as never,
    );

    await dispatcher.dispatchPendingEvents();
    await dispatcher.dispatchPendingEvents();

    expect(outboxRepository.recordFailedAttempt).toHaveBeenCalledWith(event, {
      status: "failed",
      attemptCount: 1,
      lastError: "CompetenciesLearningHandler: Redis unavailable",
    });
    expect(outboxRepository.refreshClaim).toHaveBeenCalledWith(event);
    expect(outboxRepository.markPublished).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ready", claimId: "claim" }),
    );
    expect(handleOutboxEvent).toHaveBeenCalledWith(expect.any(LessonProgressChangedEvent), {
      eventId: "ready",
    });
    expect(tenantDbRunnerService.runForEachTenant).toHaveBeenCalledTimes(2);
  });

  it("keeps delivering the other tenants when one tenant's pass fails", async () => {
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const event = {
      id: "ready",
      tenantId: "healthy-tenant",
      eventType: LessonProgressChangedEvent.name,
      payload: {},
      attemptCount: 0,
      succeededHandlers: [],
      claimId: "claim",
    };
    const outboxRepository = {
      releaseStalledClaims: jest
        .fn()
        .mockRejectedValueOnce(new Error("connection reset"))
        .mockResolvedValue(undefined),
      claimNextDueEvent: jest.fn().mockResolvedValueOnce(event).mockResolvedValue(null),
      markPublished: jest.fn(),
    };
    const outboxEventHandlerRegistry = { findEventSubscription: jest.fn().mockReturnValue(null) };
    const tenantDbRunnerService = {
      runForEachTenant: jest.fn(async (callback) => {
        await callback("failing-tenant");
        await callback("healthy-tenant");
      }),
    };
    const dispatcher = new OutboxDispatcherService(
      tenantDbRunnerService as never,
      outboxRepository as never,
      outboxEventHandlerRegistry as never,
    );

    await dispatcher.dispatchPendingEvents();

    expect(outboxRepository.markPublished).toHaveBeenCalledWith(event);
  });

  it("runs one more pass after a running one for calls made while it runs", async () => {
    let finishFirstPass = () => undefined as void;
    const firstPass = new Promise<void>((resolve) => {
      finishFirstPass = resolve;
    });
    const runForEachTenant = jest
      .fn()
      .mockImplementationOnce(() => firstPass)
      .mockResolvedValue(undefined);
    const dispatcher = new OutboxDispatcherService(
      { runForEachTenant } as never,
      {} as never,
      {} as never,
    );

    const runningCall = dispatcher.dispatchPendingEvents();
    const callsDuringPass = [
      dispatcher.dispatchPendingEvents(),
      dispatcher.dispatchPendingEvents(),
    ];

    expect(runForEachTenant).toHaveBeenCalledTimes(1);

    finishFirstPass();
    await Promise.all([runningCall, ...callsDuringPass]);

    expect(runForEachTenant).toHaveBeenCalledTimes(2);
  });
});
