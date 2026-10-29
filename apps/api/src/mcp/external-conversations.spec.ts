import { ForbiddenException } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";
import { PgDialect } from "drizzle-orm/pg-core";

import { ExternalConversationsController } from "./external-conversations.controller";
import { ExternalConversationsRepository } from "./external-conversations.repository";
import { externalConversationSchema } from "./external-conversations.schema";

import type { McpRequest, McpToolActor } from "./mcp.types";

const actor: McpToolActor = {
  email: "test@example.com",
  grant: {
    tenantId: "tenant",
    userId: "user",
    clientId: "client",
    resource: "https://tenant.test/api/mcp",
    scopes: ["student:read"],
    expiresAt: Date.now() + 1000,
  },
};
const input = {
  source: "slack" as const,
  threadKey: "pairing:workspace:channel:thread",
  messages: [
    {
      externalId: "1",
      role: "user" as const,
      text: "Hello",
      participantId: "U123",
      participantName: "Anna",
      createdAt: "2026-10-29T10:00:00Z",
    },
  ],
};

describe("Slack transcript boundaries", () => {
  it("allows only the explicit student grant and passes the authenticated actor", async () => {
    const append = jest.fn().mockResolvedValue({ id: "thread" });
    const controller = new ExternalConversationsController({
      append,
    } as unknown as ExternalConversationsRepository);
    await controller.append(input, { mcpActor: actor } as McpRequest);
    expect(append).toHaveBeenCalledWith(actor, input);
    for (const scopes of [[], ["account:access"], ["student:read", "courses:write"]]) {
      await expect(
        controller.append(input, {
          mcpActor: { ...actor, grant: { ...actor.grant, scopes } },
        } as McpRequest),
      ).rejects.toThrow(ForbiddenException);
    }
  });

  it("bounds imported payloads and rejects tool/system roles", () => {
    expect(Value.Check(externalConversationSchema, input)).toBe(true);
    expect(Value.Check(externalConversationSchema, { ...input, messages: [] })).toBe(false);
    expect(
      Value.Check(externalConversationSchema, {
        ...input,
        messages: [{ ...input.messages[0], role: "system" }],
      }),
    ).toBe(false);
    expect(Value.Check(externalConversationSchema, { ...input, threadKey: "a".repeat(501) })).toBe(
      false,
    );
  });

  it("accepts supported external platforms and reserves native conversations", () => {
    for (const source of ["slack", "discord", "whatsapp"]) expect(Value.Check(externalConversationSchema, {...input, source})).toBe(true);
    for (const source of ["mentingo", "unknown"]) expect(Value.Check(externalConversationSchema, {...input, source})).toBe(false);
    const withoutSource = {...input}; Reflect.deleteProperty(withoutSource, "source");
    expect(Value.Check(externalConversationSchema, withoutSource)).toBe(false);
  });

  it("rejects an archived, deleted or absent account before importing messages", async () => {
    const where = jest.fn().mockReturnValue({limit: jest.fn().mockResolvedValue([])});
    const db = {select: jest.fn().mockReturnValue({from: jest.fn().mockReturnValue({where})}), insert: jest.fn()};
    const runner = {runWithTenantTransaction: jest.fn(async (_tenant, fn) => fn())};
    const repository = new ExternalConversationsRepository(db as never, runner as never);
    await expect(repository.append(actor, input)).rejects.toThrow(ForbiddenException);
    expect(db.insert).not.toHaveBeenCalled();
    const statement = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(statement.params).toEqual([actor.grant.userId, actor.grant.tenantId, false]);
    expect(statement.sql).toContain('"users"."deleted_at" is null');
    expect(statement.sql).toContain('"users"."archived" =');
  });

  it("persists attribution in an authenticated namespace and uses conflict keys for retries", async () => {
    const threadConflict = jest
      .fn()
      .mockReturnValue({ returning: jest.fn().mockResolvedValue([{ id: "thread" }]) });
    const messageConflict = jest.fn().mockResolvedValue(undefined);
    const threadValues = jest.fn().mockReturnValue({ onConflictDoUpdate: threadConflict });
    const messageValues = jest.fn().mockReturnValue({ onConflictDoNothing: messageConflict });
    const db = {
      select: jest
        .fn()
        .mockReturnValue({
          from: jest
            .fn()
            .mockReturnValue({
              where: jest
                .fn()
                .mockReturnValue({
                  limit: jest.fn().mockResolvedValue([{ id: actor.grant.userId }]),
                }),
            }),
        }),
      insert: jest
        .fn()
        .mockReturnValueOnce({ values: threadValues })
        .mockReturnValueOnce({ values: messageValues }),
    };
    const runner = { runWithTenantTransaction: jest.fn(async (_tenant, fn) => fn()) };
    const repository = new ExternalConversationsRepository(db as never, runner as never);
    await repository.append(actor, input);
    expect(runner.runWithTenantTransaction).toHaveBeenCalledWith(
      actor.grant.tenantId,
      expect.any(Function),
    );
    expect(threadValues).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant",
        userId: "user",
        externalClientId: "client",
        externalThreadKey: input.threadKey,
        source: "slack",
      }),
    );
    expect(messageValues).toHaveBeenCalledWith([
      expect.objectContaining({
        threadId: "thread",
        externalMessageId: "1",
        externalUserId: "U123",
        externalUserName: "Anna",
      }),
    ]);
    expect(threadConflict.mock.calls[0][0].target).toHaveLength(5);
    expect(messageConflict.mock.calls[0][0].target).toHaveLength(3);
  });
});
