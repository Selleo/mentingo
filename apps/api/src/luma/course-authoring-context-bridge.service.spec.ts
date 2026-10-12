import { FormatRegistry } from "@sinclair/typebox";
import { validate as isUuid } from "uuid";

import { CourseAuthoringContextBridgeService } from "./course-authoring-context-bridge.service";

describe("CourseAuthoringContextBridgeService", () => {
  const tenantId = "00000000-0000-4000-8000-000000000001";
  const courseId = "00000000-0000-4000-8000-000000000002";
  const sessionId = "00000000-0000-4000-8000-000000000003";
  const eventId = "00000000-0000-4000-8000-000000000004";
  const contextRequestId = "00000000-0000-4000-8000-000000000005";
  const requestId = "00000000-0000-4000-8000-000000000006";
  const taskId = "00000000-0000-4000-8000-000000000007";
  const lessonId = "00000000-0000-4000-8000-000000000008";

  beforeAll(() => FormatRegistry.Set("uuid", isUuid));

  it("replays the durable event cursor and enqueues pending work with a stable job id", async () => {
    const binding = {
      id: "00000000-0000-4000-8000-000000000009",
      tenantId,
      courseId,
      sessionId,
      actorId: "00000000-0000-4000-8000-000000000010",
      language: "en" as const,
      cursorSequence: 4,
    };
    const requestPayload = {
      schemaVersion: 1 as const,
      contextRequestId,
      sessionId,
      requestId,
      taskId,
      taskFence: 2,
      courseId,
      language: "en" as const,
      lessonIds: [lessonId],
      targetKinds: ["lesson"],
    };
    const request = {
      ...requestPayload,
      requestHash: CourseAuthoringContextBridgeService.requestHash({
        ...requestPayload,
        requestHash: "",
      }),
    };
    const repository = {
      pollableBindings: jest.fn().mockResolvedValue([binding]),
      touchPollTime: jest.fn().mockResolvedValue(undefined),
      persistPage: jest.fn().mockResolvedValue(undefined),
      pending: jest.fn().mockResolvedValue([{ contextRequestId }]),
    };
    const getEvents = jest.fn().mockResolvedValue({
      events: [
        {
          schemaVersion: 1,
          eventId,
          sessionId,
          sequence: 5,
          occurredAt: "2026-09-24T10:00:00.000Z",
          type: "context.requested",
          payload: {
            ...request,
            record: { id: eventId, kind: "context_request", payload: request },
          },
        },
      ],
      nextSequence: 5,
      hasMore: false,
    });
    const queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const service = new CourseAuthoringContextBridgeService(
      repository as never,
      { getLumaClient: jest.fn().mockResolvedValue({ authoring: { getEvents } }) } as never,
      queue as never,
      {
        runForEachTenant: (fn: (id: string) => Promise<unknown>) => fn(tenantId),
        runWithTenant: (_id: string, fn: () => Promise<unknown>) => fn(),
      } as never,
    );

    await service.pollDisconnectedSessions();

    expect(getEvents).toHaveBeenCalledWith({ sessionId, afterSequence: 4, limit: 100 });
    expect(repository.pollableBindings).toHaveBeenCalledWith(tenantId, 50);
    expect(repository.touchPollTime).toHaveBeenCalledWith(tenantId, binding.id);
    expect(repository.pending).toHaveBeenCalledWith(tenantId, 100);
    expect(repository.persistPage).toHaveBeenCalledWith(binding, 4, 5, [
      { eventId, sequence: 5, request },
    ]);
    expect(queue.enqueue).toHaveBeenCalledWith(
      "course-authoring-context",
      "fulfill-context-request",
      { tenantId, contextRequestId },
      expect.objectContaining({ jobId: `context-${tenantId}-${contextRequestId}` }),
    );
  });

  it("produces the same response hash when object keys arrive in a different order", () => {
    expect(CourseAuthoringContextBridgeService.responseHash({ a: { y: 2, x: 1 }, b: [3, 4] })).toBe(
      CourseAuthoringContextBridgeService.responseHash({ b: [3, 4], a: { x: 1, y: 2 } }),
    );
  });

  it("queues a connected event immediately while leaving the sweep as replay fallback", async () => {
    const requestBody = {
      schemaVersion: 1 as const,
      contextRequestId,
      sessionId,
      requestId,
      taskId,
      taskFence: 2,
      courseId,
      language: "en" as const,
      lessonIds: [lessonId],
      targetKinds: ["lesson"],
    };
    const request = {
      ...requestBody,
      requestHash: CourseAuthoringContextBridgeService.requestHash({
        ...requestBody,
        requestHash: "",
      }),
    };
    const repository = { persistRealtimeRequest: jest.fn().mockResolvedValue({ id: "binding" }) };
    const queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const service = new CourseAuthoringContextBridgeService(
      repository as never,
      {} as never,
      queue as never,
      {} as never,
    );

    await service.acceptRealtimeEvent(tenantId, {
      eventId,
      sequence: 7,
      type: "context.requested",
      payload: {
        ...request,
        record: { id: eventId, kind: "context_request", payload: request },
      },
    });

    expect(repository.persistRealtimeRequest).toHaveBeenCalledWith(tenantId, {
      eventId,
      sequence: 7,
      request,
    });
    expect(queue.enqueue).toHaveBeenCalledWith(
      "course-authoring-context",
      "fulfill-context-request",
      { tenantId, contextRequestId },
      expect.objectContaining({ jobId: `context-${tenantId}-${contextRequestId}` }),
    );
  });
});
