import { AUTH_SOCKET_EVENTS } from "@repo/shared";

import { SessionRevocationService } from "src/redis/session-revocation.service";

import { SessionSocketsRevalidationService } from "./session-sockets-revalidation.service";

import type { RedisClient } from "src/redis/redis.types";
import type { WsGateway } from "src/websocket/websocket.gateway";

jest.mock("src/websocket/websocket.gateway", () => ({ WsGateway: class {} }));

const storedKeys = new Map<string, string>([
  ["auth:session-version:user-1", "session-version-1"],
  ["auth:session:user-1:session-1", "session-version-1"],
  ["auth:access-version:user-1", "access-version-current"],
]);

const redisClient = {
  mGet: async (keys: string[]) => keys.map((key) => storedKeys.get(key) ?? null),
} as unknown as RedisClient;

const createSocket = (user: Record<string, string>) => ({
  data: { user: { userId: "user-1", sessionId: "session-1", ...user } },
  emit: jest.fn(),
  disconnect: jest.fn(),
});

const revalidate = async (sockets: ReturnType<typeof createSocket>[]) => {
  const wsGateway = {
    server: { local: { fetchSockets: async () => sockets } },
  } as unknown as WsGateway;

  await new SessionSocketsRevalidationService(
    wsGateway,
    new SessionRevocationService(redisClient),
  ).disconnectRevokedSessionSockets();
};

describe("SessionSocketsRevalidationService", () => {
  it("keeps sockets whose session and access version are current", async () => {
    const socket = createSocket({
      sessionVersion: "session-version-1",
      accessVersion: "access-version-current",
    });

    await revalidate([socket]);

    expect(socket.emit).not.toHaveBeenCalled();
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it.each([
    ["an outdated access version", "access-version-outdated"],
    ["no access version", undefined],
  ])("asks sockets with %s to refresh before disconnecting them", async (_case, accessVersion) => {
    const socket = createSocket({
      sessionVersion: "session-version-1",
      ...(accessVersion && { accessVersion }),
    });

    await revalidate([socket]);

    expect(socket.emit).toHaveBeenCalledWith(AUTH_SOCKET_EVENTS.SESSION_EXPIRED);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.emit.mock.invocationCallOrder[0]).toBeLessThan(
      socket.disconnect.mock.invocationCallOrder[0],
    );
  });

  it("disconnects sockets of revoked sessions without offering a refresh", async () => {
    const socket = createSocket({
      sessionVersion: "session-version-revoked",
      accessVersion: "access-version-current",
    });

    await revalidate([socket]);

    expect(socket.emit).not.toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });
});
