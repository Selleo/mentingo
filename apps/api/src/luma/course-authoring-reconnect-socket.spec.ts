/** Loopback Socket.IO recovery with real Nest guards and explicitly synthetic domain/provider boundaries. */
import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { FormatRegistry } from "@sinclair/typebox";
import { io } from "socket.io-client";
import { validate } from "uuid";

import { SessionService } from "src/auth/session/session.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { WsJwtGuard } from "src/websocket/guards/ws-jwt.guard";

import { CourseAuthoringContextBridgeService } from "./course-authoring-context-bridge.service";
import { CourseAuthoringContextService } from "./course-authoring-context.service";
import { CourseAuthoringSessionService } from "./course-authoring-session.service";
import { CourseAuthoringGateway } from "./course-authoring.gateway";
import { LumaService } from "./luma.service";

import type { SubscribeAuthoringEventsOptions } from "@mentingo/luma-sdk";
import type { Socket } from "socket.io-client";

jest.mock("src/auth/session/session.service", () => ({ SessionService: class {} }));

const sessionId = "22222222-2222-4222-8222-222222222222";
const courseId = "33333333-3333-4333-8333-333333333333";
const claims = {
  userId: "synthetic-user",
  sessionId: "synthetic-login-session",
  sessionVersion: "1",
  tenantId: "synthetic-tenant",
  email: "authoring-recovery@example.invalid",
  roleSlugs: [],
  permissions: [],
};

/** Waits for observable server/client state, rather than relying on guessed socket delivery timing. */
async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 3000;
  while (!predicate() && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 10));
  expect(predicate()).toBe(true);
}

/** Opens a real websocket handshake using synthetic credentials checked by the real guard. */
async function connect(client: Socket): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
    client.connect();
  });
}

it("recovers the same authoring session across browser reconnects, stream closures and an auth outage", async () => {
  FormatRegistry.Set("uuid", validate);
  const warning = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  const verifySessionToken = jest.fn().mockResolvedValue(claims);
  let snapshot = {
    courseId,
    sessionId,
    snapshotSequence: 4,
    turns: [{ requestId: courseId, status: "running" }],
  };
  const get = jest.fn(async () => snapshot);
  const streams: Array<{ options: SubscribeAuthoringEventsOptions; close: () => void }> = [];
  const subscribeEvents = jest.fn(
    (options: SubscribeAuthoringEventsOptions) =>
      new Promise<void>((resolve) => {
        streams.push({ options, close: resolve });
        options.signal?.addEventListener("abort", () => resolve(), { once: true });
      }),
  );
  const module = await Test.createTestingModule({
    providers: [
      CourseAuthoringGateway,
      WsJwtGuard,
      { provide: SessionService, useValue: { verifySessionToken } },
      { provide: CourseAuthoringSessionService, useValue: { get } },
      { provide: CourseAuthoringContextService, useValue: { authorize: jest.fn() } },
      {
        provide: CourseAuthoringContextBridgeService,
        useValue: { acceptRealtimeEvent: jest.fn() },
      },
      {
        provide: LumaService,
        useValue: {
          getLumaClient: async () => ({ authoring: { subscribeEvents } }),
        },
      },
      {
        provide: TenantDbRunnerService,
        useValue: {
          runWithTenant: (_tenantId: string, callback: () => Promise<unknown>) => callback(),
        },
      },
    ],
  }).compile();
  const app = module.createNestApplication();
  let client: Socket | undefined;
  try {
    await app.listen(0, "127.0.0.1");
    const address: unknown = app.getHttpServer().address();
    if (typeof address !== "object" || address === null || !("port" in address))
      throw new Error("No loopback listener");
    client = io(`http://127.0.0.1:${address.port}/ws`, {
      path: "/api/ws",
      transports: ["websocket"],
      autoConnect: false,
      reconnection: false,
      auth: { token: "synthetic-token" },
    });
    const snapshots: (typeof snapshot)[] = [];
    const errors: unknown[] = [];
    const events: unknown[] = [];
    client.on("authoring.snapshot", (received: typeof snapshot) => snapshots.push(received));
    client.on("authoring.error", (error: unknown) => errors.push(error));
    client.on("authoring.event", (event: unknown) => events.push(event));
    await connect(client);
    const join = { courseId, sessionId, afterSequence: 4 };
    await expect(
      client.timeout(2000).emitWithAck("join:course-authoring", join),
    ).resolves.toMatchObject({
      success: true,
      sessionId,
    });
    await waitFor(() => snapshots.length === 1 && streams.length === 1);

    client.disconnect();
    await waitFor(() => streams[0]?.options.signal?.aborted === true);
    await connect(client);
    await expect(
      client.timeout(2000).emitWithAck("join:course-authoring", join),
    ).resolves.toMatchObject({
      success: true,
      sessionId,
    });
    await waitFor(() => snapshots.length === 2 && streams.length === 2);

    // A terminal event was lost while the upstream connection was closing.
    snapshot = {
      ...snapshot,
      snapshotSequence: 8,
      turns: [{ requestId: courseId, status: "completed" }],
    };
    streams[1]?.close();
    await waitFor(
      () => snapshots.some((received) => received.snapshotSequence === 8) && streams.length === 3,
    );
    expect(streams[2]?.options.afterSequence).toBe(8);
    expect(snapshots.at(-1)?.turns[0]?.status).toBe("completed");

    // A real guard verification outage must deny delivery without permanently disconnecting the client.
    verifySessionToken.mockRejectedValueOnce(new Error("Synthetic Redis outage"));
    snapshot = { ...snapshot, snapshotSequence: 10 };
    await streams[2]?.options.onEvent({
      schemaVersion: 1,
      eventId: courseId,
      sessionId,
      sequence: 9,
      occurredAt: new Date().toISOString(),
      type: "task.updated",
      payload: {},
    });
    await waitFor(
      () => snapshots.some((received) => received.snapshotSequence === 10) && streams.length === 4,
    );
    expect(client.connected).toBe(true);
    expect(events).toEqual([]);
    expect(errors).toEqual([]);
    expect(streams[3]?.options.afterSequence).toBe(10);

    snapshot = { ...snapshot, snapshotSequence: 12 };
    streams[3]?.close();
    await waitFor(
      () => snapshots.some((received) => received.snapshotSequence === 12) && streams.length === 5,
    );
    expect(streams[4]?.options.afterSequence).toBe(12);
    expect(snapshots.every((received) => received.sessionId === sessionId)).toBe(true);
    expect(verifySessionToken).toHaveBeenCalledWith("synthetic-token", "access");
    expect(errors).toEqual([]);
  } finally {
    client?.close();
    await app.close();
    warning.mockRestore();
  }
}, 15000);
