import { ForbiddenException, GoneException, Logger, NotFoundException } from "@nestjs/common";
import { FormatRegistry } from "@sinclair/typebox";
import { validate } from "uuid";

import { CourseAuthoringGateway } from "./course-authoring.gateway";

import type { CourseAuthoringSessionService } from "./course-authoring-session.service";
import type { LumaService } from "./luma.service";
import type { SubscribeAuthoringEventsOptions } from "@mentingo/luma-sdk";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import type { WsJwtGuard } from "src/websocket/guards/ws-jwt.guard";
import type { AuthenticatedSocket } from "src/websocket/websocket.types";

const sessionId = "00000000-0000-4000-8000-000000000001";
const courseId = "00000000-0000-4000-8000-000000000002";
const tenantId = "00000000-0000-4000-8000-000000000003";

describe("CourseAuthoringGateway durable subscriptions", () => {
  beforeAll(() => FormatRegistry.Set("uuid", validate));
  beforeEach(() => jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  async function waitFor(predicate: () => boolean, timeout = 1500) {
    const deadline = Date.now() + timeout;
    while (!predicate() && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 10));
    expect(predicate()).toBe(true);
  }

  function createSocket(id: string): AuthenticatedSocket {
    return {
      id,
      data: { user: { tenantId, userId: courseId } },
      emit: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuthenticatedSocket;
  }

  function setup() {
    const options: SubscribeAuthoringEventsOptions[] = [];
    const resolvers: Array<() => void> = [];
    const rejectors: Array<(error: unknown) => void> = [];
    const get = jest.fn().mockResolvedValue({ courseId, sessionId, snapshotSequence: 4 });
    const subscribeEvents = jest.fn((input: SubscribeAuthoringEventsOptions) => {
      options.push(input);
      return new Promise<void>((resolve, reject) => {
        resolvers.push(resolve);
        rejectors.push(reject);
        input.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });
    const authenticateCurrent = jest.fn().mockResolvedValue(true);
    const authorize = jest.fn().mockResolvedValue(undefined);
    const acceptRealtimeEvent = jest.fn().mockResolvedValue(undefined);
    const gateway = new CourseAuthoringGateway(
      { get, authorizeAccess: authorize } as unknown as CourseAuthoringSessionService,
      {
        getLumaClient: jest.fn().mockResolvedValue({ authoring: { subscribeEvents } }),
      } as unknown as LumaService,
      {
        runWithTenant: (_tenant: string, fn: () => Promise<unknown>) => fn(),
      } as unknown as TenantDbRunnerService,
      { authenticateCurrent } as unknown as WsJwtGuard,
      { acceptRealtimeEvent } as never,
    );
    return {
      gateway,
      get,
      socket: createSocket("socket1"),
      createSocket,
      subscribeEvents,
      authenticateCurrent,
      authorize,
      acceptRealtimeEvent,
      getOptions: (index = options.length - 1) => options[index],
      getOptionCount: () => options.length,
      disconnect: (index: number) => resolvers[index]?.(),
      fail: (index: number, error: unknown) => rejectors[index]?.(error),
    };
  }

  it("shares one stream across duplicate joins and cancels when its last subscriber leaves", async () => {
    const test = setup();
    await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
    await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 4 });
    expect(test.subscribeEvents).toHaveBeenCalledTimes(1);
    expect(test.getOptions()?.afterSequence).toBe(4);
    test.gateway.handleDisconnect(test.socket);
    expect(test.getOptions()?.signal?.aborted).toBe(true);
    test.gateway.onModuleDestroy();
  });

  it("acknowledges a matching browser snapshot and starts the shared stream from its cursor", async () => {
    const test = setup();
    await test.gateway.join(test.socket, {
      courseId,
      sessionId,
      afterSequence: 4,
      hasSnapshot: true,
    });

    expect(test.socket.emit).toHaveBeenCalledWith("authoring.ready", {
      courseId,
      sessionId,
      afterSequence: 4,
    });
    expect(test.socket.emit).not.toHaveBeenCalledWith("authoring.snapshot", expect.anything());
    expect(test.getOptions()?.afterSequence).toBe(4);
    test.gateway.onModuleDestroy();
  });

  it.each([3, 5])(
    "returns the authoritative snapshot for an unmatched cursor of %i",
    async (cursor) => {
      const test = setup();
      await test.gateway.join(test.socket, {
        courseId,
        sessionId,
        afterSequence: cursor,
        hasSnapshot: true,
      });

      expect(test.socket.emit).toHaveBeenCalledWith("authoring.snapshot", {
        courseId,
        sessionId,
        snapshotSequence: 4,
      });
      expect(test.socket.emit).not.toHaveBeenCalledWith("authoring.ready", expect.anything());
      expect(test.getOptions()?.afterSequence).toBe(4);
      test.gateway.onModuleDestroy();
    },
  );

  it("delivers course attachment as a delta to clients that support a cached snapshot", async () => {
    const test = setup();
    const legacySocket = test.createSocket("legacy-socket");
    await test.gateway.join(test.socket, {
      courseId,
      sessionId,
      afterSequence: 4,
      hasSnapshot: true,
    });
    await test.gateway.join(legacySocket, { courseId, sessionId, afterSequence: 4 });
    const event = {
      schemaVersion: 1 as const,
      eventId: courseId,
      sessionId,
      sequence: 5,
      occurredAt: new Date().toISOString(),
      type: "session.course_attached",
      payload: { courseId: "00000000-0000-4000-8000-000000000004", language: "en" },
    };

    await test.getOptions()?.onEvent(event);

    expect(test.socket.emit).toHaveBeenCalledWith("authoring.event", event);
    expect(test.socket.emit).not.toHaveBeenCalledWith("authoring.resync", expect.anything());
    expect(legacySocket.emit).toHaveBeenCalledWith("authoring.resync", { sessionId });
    test.gateway.onModuleDestroy();
  });

  it("forwards each durable event before consuming the next event", async () => {
    const test = setup();
    await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
    const first = {
      schemaVersion: 1 as const,
      eventId: courseId,
      sessionId,
      sequence: 5,
      occurredAt: new Date().toISOString(),
      type: "assistant.message",
      payload: { message: "first" },
    };
    const second = { ...first, eventId: tenantId, sequence: 6, payload: { message: "second" } };

    await test.getOptions(0)?.onEvent(first);
    expect(test.socket.emit).toHaveBeenNthCalledWith(2, "authoring.event", first);
    expect(test.authorize).toHaveBeenCalledWith(courseId, sessionId, test.socket.data.user, {
      refreshDraftActivity: false,
    });

    await test.getOptions(0)?.onEvent(second);
    expect(test.socket.emit).toHaveBeenNthCalledWith(3, "authoring.event", second);
    expect(test.socket.emit).not.toHaveBeenCalledWith("authoring.snapshot", second);
    test.gateway.onModuleDestroy();
  });

  it("hands live context requests to the durable bridge fast path", async () => {
    const test = setup();
    await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
    const event = {
      schemaVersion: 1 as const,
      eventId: courseId,
      sessionId,
      sequence: 5,
      occurredAt: new Date().toISOString(),
      type: "context.requested",
      payload: { contextRequestId: tenantId },
    };

    await test.getOptions(0)?.onEvent(event);

    expect(test.acceptRealtimeEvent).toHaveBeenCalledWith(tenantId, event);
    expect(test.socket.emit).toHaveBeenCalledWith("authoring.event", event);
    test.gateway.onModuleDestroy();
  });

  it("replays from a durable cursor after a transient upstream disconnect", async () => {
    const test = setup();
    await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
    test.disconnect(0);
    await waitFor(() => test.getOptionCount() === 2);
    expect(test.getOptions(1)?.afterSequence).toBe(4);

    const event = {
      schemaVersion: 1 as const,
      eventId: courseId,
      sessionId,
      sequence: 5,
      occurredAt: new Date().toISOString(),
      type: "task.updated",
      payload: {},
    };
    await test.getOptions(1)?.onEvent(event);
    expect(test.socket.emit).toHaveBeenCalledWith("authoring.event", event);
    test.gateway.onModuleDestroy();
  });

  it("reconciles a sequence gap and keeps the shared stream alive", async () => {
    const test = setup();
    await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
    test.get.mockResolvedValueOnce({ courseId, sessionId, snapshotSequence: 8 });

    await test.getOptions(0)?.onEvent({
      schemaVersion: 1,
      eventId: courseId,
      sessionId,
      sequence: 7,
      occurredAt: new Date().toISOString(),
      type: "task.updated",
      payload: {},
    });
    await waitFor(() => test.getOptionCount() === 2);

    expect(test.socket.emit).toHaveBeenCalledWith("authoring.resync", { sessionId });
    expect(test.socket.emit).toHaveBeenCalledWith("authoring.snapshot", {
      courseId,
      sessionId,
      snapshotSequence: 8,
    });
    expect(test.getOptions(1)?.afterSequence).toBe(8);

    const event = {
      schemaVersion: 1 as const,
      eventId: tenantId,
      sessionId,
      sequence: 9,
      occurredAt: new Date().toISOString(),
      type: "assistant.message",
      payload: { message: "replayed" },
    };
    await test.getOptions(1)?.onEvent(event);
    expect(test.socket.emit).toHaveBeenCalledWith("authoring.event", event);
    test.gateway.onModuleDestroy();
  });

  it("delivers reconciliation to members that join while recovery is in progress", async () => {
    const test = setup();
    await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
    let resolveRecovery: (snapshot: {
      courseId: string;
      sessionId: string;
      snapshotSequence: number;
    }) => void = () => undefined;
    const recovery = new Promise<{ courseId: string; sessionId: string; snapshotSequence: number }>(
      (resolve) => {
        resolveRecovery = resolve;
      },
    );
    test.get.mockReturnValueOnce(recovery);
    const gap = test.getOptions(0)?.onEvent({
      schemaVersion: 1,
      eventId: courseId,
      sessionId,
      sequence: 7,
      occurredAt: new Date().toISOString(),
      type: "task.updated",
      payload: {},
    });
    await waitFor(() => test.get.mock.calls.length === 2);

    const secondSocket = test.createSocket("socket2");
    await test.gateway.join(secondSocket, { courseId, sessionId, afterSequence: 0 });
    resolveRecovery({ courseId, sessionId, snapshotSequence: 8 });
    await gap;
    await waitFor(() => test.getOptionCount() === 2);

    expect(secondSocket.emit).toHaveBeenCalledWith("authoring.snapshot", {
      courseId,
      sessionId,
      snapshotSequence: 8,
    });
    test.gateway.onModuleDestroy();
  });

  it("keeps authorized members streaming when another member is revoked during recovery", async () => {
    const test = setup();
    const secondSocket = test.createSocket("socket2");
    await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
    await test.gateway.join(secondSocket, { courseId, sessionId, afterSequence: 0 });
    test.get.mockResolvedValueOnce({ courseId, sessionId, snapshotSequence: 8 });
    test.authorize.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new ForbiddenException());

    await test.getOptions(0)?.onEvent({
      schemaVersion: 1,
      eventId: courseId,
      sessionId,
      sequence: 7,
      occurredAt: new Date().toISOString(),
      type: "task.updated",
      payload: {},
    });
    await waitFor(() => test.getOptionCount() === 2);

    expect(secondSocket.emit).toHaveBeenCalledWith("authoring.snapshot", {
      courseId,
      sessionId,
      snapshotSequence: 8,
    });
    expect(test.socket.emit).toHaveBeenCalledWith("authoring.error", {
      sessionId,
      code: "permission_revoked",
    });
    test.gateway.onModuleDestroy();
  });

  it("rechecks authorization before delivery and excludes a revoked editor", async () => {
    const test = setup();
    await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
    test.authorize.mockRejectedValueOnce(new ForbiddenException());
    await test.getOptions(0)?.onEvent({
      schemaVersion: 1,
      eventId: courseId,
      sessionId,
      sequence: 5,
      occurredAt: new Date().toISOString(),
      type: "task.updated",
      payload: {},
    });
    expect(test.authenticateCurrent).toHaveBeenCalledTimes(2);
    expect(test.socket.emit).toHaveBeenCalledWith("authoring.error", {
      sessionId,
      code: "permission_revoked",
    });
    expect(test.socket.emit).not.toHaveBeenCalledWith("authoring.event", expect.anything());
    test.gateway.onModuleDestroy();
  });

  it.each([new NotFoundException(), new GoneException()])(
    "rejects a terminal session once without creating a subscription (%s)",
    async (error) => {
      const test = setup();
      test.get.mockRejectedValue(error);

      await expect(
        test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 }),
      ).resolves.toEqual({
        success: false,
        sessionId,
        code: "session_not_found",
      });
      expect(test.socket.emit).toHaveBeenCalledTimes(1);
      expect(test.socket.emit).toHaveBeenCalledWith("authoring.error", {
        sessionId,
        code: "session_not_found",
      });
      expect(test.subscribeEvents).not.toHaveBeenCalled();
    },
  );

  it("releases all subscribers when a draft expires before delivery", async () => {
    const test = setup();
    const second = test.createSocket("socket2");
    await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
    await test.gateway.join(second, { courseId, sessionId, afterSequence: 0 });
    test.authorize.mockRejectedValueOnce(new GoneException());

    await test.getOptions(0)?.onEvent({
      schemaVersion: 1,
      eventId: courseId,
      sessionId,
      sequence: 5,
      occurredAt: new Date().toISOString(),
      type: "task.updated",
      payload: {},
    });

    for (const member of [test.socket, second]) {
      expect(member.emit).toHaveBeenCalledWith("authoring.error", {
        sessionId,
        code: "session_not_found",
      });
      expect(member.emit).not.toHaveBeenCalledWith("authoring.event", expect.anything());
      expect(member.leave).toHaveBeenCalledTimes(1);
    }
    expect(test.getOptions(0)?.signal?.aborted).toBe(true);
    expect(test.subscribeEvents).toHaveBeenCalledTimes(1);
    test.gateway.onModuleDestroy();
  });

  it.each(["authenticateCurrent", "authorize"] as const)(
    "reconciles without revoking access after a transient %s failure during delivery",
    async (verification) => {
      const test = setup();
      await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
      test[verification].mockRejectedValueOnce(new Error("database unavailable"));
      const completed = {
        courseId,
        sessionId,
        snapshotSequence: 6,
        turns: [{ requestId: courseId, status: "completed" }],
      };
      test.get.mockResolvedValueOnce(completed);

      await test.getOptions(0)?.onEvent({
        schemaVersion: 1,
        eventId: courseId,
        sessionId,
        sequence: 5,
        occurredAt: new Date().toISOString(),
        type: "task.updated",
        payload: {},
      });

      expect(test.socket.emit).not.toHaveBeenCalledWith("authoring.event", expect.anything());
      expect(test.socket.emit).not.toHaveBeenCalledWith("authoring.error", expect.anything());
      expect(test.getOptions(0)?.signal?.aborted).toBe(true);
      await waitFor(() => test.getOptionCount() === 2);
      expect(test.socket.emit).toHaveBeenCalledWith("authoring.snapshot", completed);
      expect(test.getOptions(1)?.afterSequence).toBe(6);
      test.gateway.onModuleDestroy();
    },
  );

  it("refreshes completion state across repeated stream closures without recreating the session", async () => {
    const test = setup();
    await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
    for (const streamIndex of [0, 1]) {
      const sequence = 5 + streamIndex;
      const snapshot = {
        courseId,
        sessionId,
        snapshotSequence: sequence,
        turns: [{ requestId: courseId, status: streamIndex === 1 ? "completed" : "running" }],
      };
      test.get.mockResolvedValueOnce(snapshot);
      test.disconnect(streamIndex);
      await waitFor(() => test.getOptionCount() === streamIndex + 2, 2500);
      expect(test.getOptions(streamIndex + 1)?.afterSequence).toBe(sequence);
      expect(test.socket.emit).toHaveBeenCalledWith("authoring.snapshot", snapshot);
    }
    expect(test.get).toHaveBeenCalledTimes(3);
    expect(test.socket.emit).not.toHaveBeenCalledWith("authoring.error", expect.anything());
    test.gateway.onModuleDestroy();
  });

  it("retries snapshot recovery after a transient outage before opening the next stream", async () => {
    const test = setup();
    await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
    test.get.mockRejectedValueOnce(new Error("database unavailable"));
    test.get.mockResolvedValueOnce({ courseId, sessionId, snapshotSequence: 9 });
    test.disconnect(0);

    await waitFor(() => test.get.mock.calls.length === 2);
    expect(test.getOptionCount()).toBe(1);
    expect(test.socket.emit).not.toHaveBeenCalledWith("authoring.error", expect.anything());
    await waitFor(() => test.getOptionCount() === 2, 2500);
    expect(test.getOptions(1)?.afterSequence).toBe(9);
    test.gateway.onModuleDestroy();
  });

  it.each([new NotFoundException(), new GoneException()])(
    "ends a terminal session during recovery and releases its subscription (%s)",
    async (error) => {
      const test = setup();
      await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
      test.get.mockRejectedValueOnce(error);
      test.disconnect(0);

      await waitFor(() => {
        const messages: readonly (readonly unknown[])[] = jest.mocked(test.socket.emit).mock.calls;
        return messages.some(
          ([name, payload]) =>
            name === "authoring.error" &&
            typeof payload === "object" &&
            payload !== null &&
            "code" in payload &&
            payload.code === "session_not_found",
        );
      });
      expect(test.socket.emit).toHaveBeenCalledWith("authoring.error", {
        sessionId,
        code: "session_not_found",
      });
      expect(test.subscribeEvents).toHaveBeenCalledTimes(1);
      expect(test.getOptions(0)?.signal?.aborted).toBe(true);
      expect(test.socket.leave).toHaveBeenCalledTimes(1);

      // A later explicit join must get a new consumer, rather than attach to a dead one.
      await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
      expect(test.subscribeEvents).toHaveBeenCalledTimes(2);
      test.gateway.onModuleDestroy();
    },
  );

  it("logs a safe transport reason and connection duration before recovering", async () => {
    const test = setup();
    await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
    test.fail(0, Object.assign(new Error("secret provider response"), { code: "ETIMEDOUT" }));
    await waitFor(() => jest.mocked(Logger.prototype.warn).mock.calls.length > 0);

    const logged = jest.mocked(Logger.prototype.warn).mock.calls[0]?.[0];
    expect(JSON.parse(String(logged))).toMatchObject({
      connectedForMs: expect.any(Number),
      code: "ETIMEDOUT",
    });
    expect(logged).not.toContain("secret provider response");
    test.gateway.onModuleDestroy();
  });

  it("does not revoke a replacement subscription when an old authorization finishes late", async () => {
    const test = setup();
    await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 0 });
    let rejectAuthorization: (error: Error) => void = () => undefined;
    test.authorize.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectAuthorization = reject;
        }),
    );
    const delivery = test.getOptions(0)?.onEvent({
      schemaVersion: 1,
      eventId: courseId,
      sessionId,
      sequence: 5,
      occurredAt: new Date().toISOString(),
      type: "task.updated",
      payload: {},
    });
    await waitFor(() => test.authorize.mock.calls.length === 1);
    test.gateway.handleDisconnect(test.socket);
    await test.gateway.join(test.socket, { courseId, sessionId, afterSequence: 4 });
    expect(test.getOptionCount()).toBe(2);

    rejectAuthorization(new ForbiddenException());
    await delivery;

    expect(test.getOptions(1)?.signal?.aborted).toBe(false);
    expect(test.socket.emit).not.toHaveBeenCalledWith("authoring.error", expect.anything());
    test.gateway.onModuleDestroy();
  });
});
