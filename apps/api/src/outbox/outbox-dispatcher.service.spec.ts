import { Logger } from "@nestjs/common";

import { OutboxDispatcherService } from "./outbox-dispatcher.service";

describe("OutboxDispatcherService", () => {
  it("continues dispatching after competency queue intake fails and releases its running guard", async () => {
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const event = {
      id: "failed",
      tenantId: "tenant",
      eventType: "LessonProgressChangedEvent",
      payload: { data: { userId: "learner", courseId: "course" } },
      attemptCount: 0,
    };
    const outboxRepository = {
      recoverStalledIntake: jest.fn(),
      claimNext: jest
        .fn()
        .mockResolvedValueOnce(event)
        .mockResolvedValueOnce({ ...event, id: "ready" })
        .mockResolvedValue(null),
      markFailed: jest.fn(),
      markPublished: jest.fn(),
    };
    const eventBus = { publish: jest.fn() };
    const outboxDirectHandlerService = {
      dispatchReactions: jest
        .fn()
        .mockRejectedValueOnce(new Error("Redis unavailable"))
        .mockResolvedValue(undefined),
      dispatch: jest.fn().mockResolvedValue(false),
    };
    const tenantDbRunnerService = {
      runForEachTenant: jest.fn(async (callback) => callback("tenant")),
    };
    const dispatcher = new OutboxDispatcherService(
      tenantDbRunnerService as never,
      outboxRepository as never,
      eventBus as never,
      outboxDirectHandlerService as never,
    );

    await dispatcher.dispatchPendingEvents();
    await dispatcher.dispatchPendingEvents();

    expect(outboxRepository.markFailed).toHaveBeenCalledWith(
      "failed",
      expect.objectContaining({ message: "Redis unavailable" }),
      1,
    );
    expect(outboxRepository.markPublished).toHaveBeenCalledWith("ready");
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(tenantDbRunnerService.runForEachTenant).toHaveBeenCalledTimes(2);
  });
});
