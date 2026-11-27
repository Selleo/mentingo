import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import {
  ASSISTANT_MESSAGE_ROLES,
  ASSISTANT_MESSAGE_STATUSES,
  ASSISTANT_RUN_STATUSES,
  ASSISTANT_SOCKET_EVENTS,
  TENANT_STATUSES,
  type AssistantTranscriptUpdate,
} from "@repo/shared";
import { FormatRegistry } from "@sinclair/typebox";
import { io as socketIo, type Socket } from "socket.io-client";
import { validate } from "uuid";

import { SessionService } from "src/auth/session/session.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { WsJwtGuard } from "src/websocket/guards/ws-jwt.guard";
import { REALTIME_PUBLISHER } from "src/websocket/realtime.publisher";
import { SocketRealtimePublisher } from "src/websocket/realtime.publisher.service";
import { WsGateway } from "src/websocket/websocket.gateway";

import { AssistantRealtimeService } from "./assistant-realtime.service";
import { AssistantGateway } from "./assistant.gateway";
import { AssistantRepository } from "./assistant.repository";

import type { AssistantActorIdentity, AssistantMessage, AssistantRun } from "./assistant.types";

jest.mock("src/auth/session/session.service", () => ({ SessionService: class {} }));

it("delivers persisted updates to the matching room and disconnects only the revoked session", async () => {
  FormatRegistry.Set("uuid", validate);
  const owner = { tenantId: randomUUID(), userId: randomUUID() };
  const viewer = { ...owner, sessionId: randomUUID() };
  const peer = { ...owner, sessionId: randomUUID() };
  const otherTenant = { ...owner, tenantId: randomUUID(), sessionId: randomUUID() };
  const threadId = randomUUID();
  const sessions = new Map([
    ["viewer", viewer],
    ["peer", peer],
    ["other-tenant", otherTenant],
  ]);
  const module = await Test.createTestingModule({
    providers: [
      AssistantGateway,
      AssistantRealtimeService,
      WsGateway,
      WsJwtGuard,
      SocketRealtimePublisher,
      { provide: REALTIME_PUBLISHER, useExisting: SocketRealtimePublisher },
      {
        provide: SessionService,
        useValue: {
          verifySessionToken: async (token: string) => ({
            ...sessions.get(token),
            sessionVersion: "1",
            accessVersion: "synthetic-access-version",
          }),
        },
      },
      {
        provide: TenantDbRunnerService,
        useValue: { runWithTenant: (_tenantId: string, operation: () => unknown) => operation() },
      },
      {
        provide: AssistantRepository,
        useValue: {
          findTenantState: async () => ({ status: TENANT_STATUSES.ACTIVE, accessEndsAt: null }),
          isAccountActive: async () => true,
          ownsThread: async (actor: AssistantActorIdentity, requested: string) =>
            actor.userId === owner.userId &&
            actor.tenantId === owner.tenantId &&
            requested === threadId,
        },
      },
    ],
  }).compile();

  const app = module.createNestApplication();
  const clients: Socket[] = [];
  try {
    await app.listen(0, "127.0.0.1");
    const address: unknown = app.getHttpServer().address();
    if (typeof address !== "object" || address === null || !("port" in address))
      throw new Error("No loopback listener");
    const connect = async (token: string) => {
      const socket = socketIo(`http://127.0.0.1:${address.port}/ws`, {
        path: "/api/ws",
        transports: ["websocket"],
        autoConnect: false,
        reconnection: false,
        auth: { token },
      });
      clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
        socket.connect();
      });
      return socket;
    };
    const first = await connect("viewer");
    const second = await connect("peer");
    const isolated = await connect("other-tenant");
    const payload = { threadId, userId: owner.userId };
    const join = (socket: Socket) =>
      socket.timeout(2000).emitWithAck(ASSISTANT_SOCKET_EVENTS.JOIN, payload);
    await expect(join(first)).resolves.toEqual({ success: true });
    await expect(join(second)).resolves.toEqual({ success: true });
    await expect(join(isolated)).resolves.toEqual({ success: false });
    const leaked = jest.fn();
    isolated.on(ASSISTANT_SOCKET_EVENTS.TRANSCRIPT_UPDATED, leaked);

    const runId = randomUUID();
    const messageId = randomUUID();
    const updatedAt = new Date().toISOString();
    const publish = (text: string) =>
      module.get(AssistantRealtimeService).publish(
        {
          ...owner,
          id: runId,
          threadId,
          status: ASSISTANT_RUN_STATUSES.RUNNING,
          updatedAt,
        } as AssistantRun,
        {
          id: messageId,
          threadId,
          role: ASSISTANT_MESSAGE_ROLES.ASSISTANT,
          status: ASSISTANT_MESSAGE_STATUSES.RUNNING,
          text,
          tenantId: owner.tenantId,
          createdAt: updatedAt,
          updatedAt,
          sources: [],
          clientMessageId: null,
          externalMessageId: null,
          externalUserId: null,
          externalUserName: null,
        } as AssistantMessage,
      );
    const receive = (socket: Socket) =>
      new Promise<AssistantTranscriptUpdate>((resolve) =>
        socket.once(ASSISTANT_SOCKET_EVENTS.TRANSCRIPT_UPDATED, resolve),
      );
    const updates = [receive(first), receive(second)];
    publish("Partial reply");
    for (const update of await Promise.all(updates))
      expect(update.assistantMessage.text).toBe("Partial reply");

    const disconnected = new Promise<string>((resolve) => first.once("disconnect", resolve));
    module.get(WsGateway).disconnectSession(viewer.sessionId);
    await expect(disconnected).resolves.toBe("io server disconnect");
    expect(second.connected).toBe(true);
    const remaining = receive(second);
    publish("Continued reply");
    await expect(remaining).resolves.toMatchObject({
      threadId,
      assistantMessage: { text: "Continued reply" },
    });
    expect(leaked).not.toHaveBeenCalled();
  } finally {
    clients.forEach((socket) => socket.close());
    await app.close();
  }
}, 10000);
