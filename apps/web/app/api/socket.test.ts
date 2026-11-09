import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  io: vi.fn(),
}));
vi.mock("socket.io-client", () => ({ io: mocks.io }));
vi.mock("./api-client", () => ({
  ApiClient: { api: { authControllerRefreshTokens: mocks.refresh } },
}));

describe("socket credential recovery", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  async function setup() {
    const listeners = new Map<string, () => Promise<void>>();
    const client = {
      on: vi.fn((event: string, handler: () => Promise<void>) => listeners.set(event, handler)),
      connect: vi.fn(),
      disconnect: vi.fn().mockReturnThis(),
      off: vi.fn((event: string) => listeners.delete(event)),
    };
    client.connect.mockImplementation(() => {
      void listeners.get("connect")?.();
      return client;
    });
    mocks.io.mockReturnValue(client);
    const api = await import("./socket");
    api.acquireSocket();
    return { ...api, client, expire: () => listeners.get("auth:expired")?.() };
  }

  it("refreshes before starting a fresh handshake for existing connect handlers", async () => {
    let resolve: () => void = () => undefined;
    mocks.refresh.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const { client, expire } = await setup();
    const rejoinRoom = vi.fn(async () => undefined);
    client.on("connect", rejoinRoom);
    const recovery = expire();
    await expire();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(client.connect).not.toHaveBeenCalled();
    resolve();
    await recovery;
    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(rejoinRoom).toHaveBeenCalledTimes(1);
    expect(client.disconnect.mock.invocationCallOrder[0]).toBeLessThan(
      client.connect.mock.invocationCallOrder[0],
    );
  });

  it.each([401, 403, 500])("does not reconnect after a failed refresh (%s)", async (status) => {
    mocks.refresh.mockRejectedValue({ response: { status } });
    const { client, expire } = await setup();
    await expire();
    expect(client.connect).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not revive a released socket after refresh finishes", async () => {
    let resolve: () => void = () => undefined;
    mocks.refresh.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const { client, expire, releaseSocket } = await setup();
    const recovery = expire();
    releaseSocket();
    expect(client.off).toHaveBeenCalledWith("auth:expired", expect.any(Function));
    resolve();
    await recovery;
    expect(client.connect).not.toHaveBeenCalled();
    await expire();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps recovery registered until the last consumer releases the socket", async () => {
    const { client, acquireSocket, releaseSocket, expire } = await setup();
    expect(acquireSocket()).toBe(client);
    releaseSocket();
    expect(client.off).not.toHaveBeenCalled();
    expect(client.disconnect).not.toHaveBeenCalled();
    await expire();
    expect(client.connect).toHaveBeenCalledTimes(1);
    releaseSocket();
    expect(client.off).toHaveBeenCalledTimes(1);
  });

  it("does not reconnect an old socket when a replacement is acquired during refresh", async () => {
    let resolve: () => void = () => undefined;
    mocks.refresh.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const { client, acquireSocket, releaseSocket, expire } = await setup();
    const recovery = expire();
    releaseSocket();
    const replacement = { on: vi.fn(), off: vi.fn(), connect: vi.fn(), disconnect: vi.fn() };
    mocks.io.mockReturnValue(replacement);
    expect(acquireSocket()).toBe(replacement);
    resolve();
    await recovery;
    expect(client.connect).not.toHaveBeenCalled();
    expect(replacement.connect).not.toHaveBeenCalled();
    releaseSocket();
  });
});
