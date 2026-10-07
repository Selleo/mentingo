import { NotFoundException } from "@nestjs/common";
import { FormatRegistry } from "@sinclair/typebox";
import { validate } from "uuid";

import { CourseAuthoringGateway } from "./course-authoring.gateway";

import type { CourseAuthoringContextService } from "./course-authoring-context.service";
import type { CourseAuthoringSessionService } from "./course-authoring-session.service";
import type { LumaService } from "./luma.service";
import type { SubscribeAuthoringEventsOptions } from "@japro/luma-sdk";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import type { WsJwtGuard } from "src/websocket/guards/ws-jwt.guard";
import type { AuthenticatedSocket } from "src/websocket/websocket.types";

const sessionId = "00000000-0000-4000-8000-000000000001";
const courseId = "00000000-0000-4000-8000-000000000002";
const tenantId = "00000000-0000-4000-8000-000000000003";

describe("CourseAuthoringGateway durable subscriptions", () => {
  beforeAll(() => FormatRegistry.Set("uuid", validate));

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
    const get = jest.fn().mockResolvedValue({ courseId, sessionId, snapshotSequence: 4 });
    const subscribeEvents = jest.fn((input: SubscribeAuthoringEventsOptions) => {
      options.push(input);
      return new Promise<void>((resolve) => {
        resolvers.push(resolve);
        input.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });
    const authenticateCurrent = jest.fn().mockResolvedValue(true);
    const authorize = jest.fn().mockResolvedValue(undefined);
    const acceptRealtimeEvent = jest.fn().mockResolvedValue(undefined);
    const gateway = new CourseAuthoringGateway(
      { get } as unknown as CourseAuthoringSessionService,
      { authorize } as unknown as CourseAuthoringContextService,
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
    let resolveRecovery!: (snapshot: {
      courseId: string;
      sessionId: string;
      snapshotSequence: number;
    }) => void;
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
    test.authorize.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("revoked"));

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
    test.authorize.mockRejectedValueOnce(new Error("revoked"));
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

  it("acknowledges a deleted session once without creating a subscription", async () => {
    const test = setup();
    const missing = new NotFoundException("courseAuthoring.errors.sessionNotFound");
    test.get.mockRejectedValue(missing);

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
  });
});
