import { randomUUID } from "node:crypto";

import { TENANT_STATUSES } from "@repo/shared";
import { FormatRegistry } from "@sinclair/typebox";
import { validate } from "uuid";

import { AssistantGateway } from "./assistant.gateway";

describe("Assistant transcript socket subscription", () => {
  const actor = { tenantId: randomUUID(), userId: randomUUID(), sessionId: randomUUID() };
  const threadId = randomUUID();
  const room = `assistant:${actor.tenantId}:${actor.userId}:${threadId}`;
  const repository = {
    findTenantState: jest.fn(),
    isAccountActive: jest.fn(),
    ownsThread: jest.fn(),
  };
  const runWithTenant = jest.fn(async (_tenantId, operation) => operation());
  const socket = {
    connected: true,
    data: { user: actor },
    join: jest.fn(),
    leave: jest.fn(),
  };
  const gateway = new AssistantGateway(repository as never, { runWithTenant } as never);

  beforeAll(() => FormatRegistry.Set("uuid", validate));

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findTenantState.mockResolvedValue({ status: TENANT_STATUSES.ACTIVE });
    repository.isAccountActive.mockResolvedValue(true);
    repository.ownsThread.mockResolvedValue(true);
  });

  it("joins and leaves the room derived from the authenticated tenant and actor", async () => {
    const payload = { threadId, userId: actor.userId };
    await expect(gateway.join(socket as never, payload)).resolves.toEqual({ success: true });
    expect(runWithTenant).toHaveBeenCalledWith(actor.tenantId, expect.any(Function));
    expect(repository.ownsThread).toHaveBeenCalledWith(actor, threadId);
    expect(socket.join).toHaveBeenCalledWith(room);
    await expect(gateway.leave(socket as never, payload)).resolves.toEqual({ success: true });
    expect(socket.leave).toHaveBeenCalledWith(room);
  });

  it("rejects another actor or a client-specified tenant before checking thread ownership", async () => {
    await expect(
      gateway.join(socket as never, { threadId, userId: randomUUID() }),
    ).resolves.toEqual({ success: false });
    await expect(
      gateway.join(socket as never, { threadId, userId: actor.userId, tenantId: randomUUID() }),
    ).resolves.toEqual({ success: false });
    expect(repository.ownsThread).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
  });

  it("does not join threads outside the actor's tenant/ownership or activity scope", async () => {
    const payload = { threadId, userId: actor.userId };
    repository.ownsThread.mockResolvedValueOnce(false);
    await expect(gateway.join(socket as never, payload)).resolves.toEqual({ success: false });
    repository.isAccountActive.mockResolvedValueOnce(false);
    await expect(gateway.join(socket as never, payload)).resolves.toEqual({ success: false });
    repository.findTenantState.mockResolvedValueOnce({ status: TENANT_STATUSES.INACTIVE });
    await expect(gateway.join(socket as never, payload)).resolves.toEqual({ success: false });
    expect(socket.join).not.toHaveBeenCalled();
  });
});
