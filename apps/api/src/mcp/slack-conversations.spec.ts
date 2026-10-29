import { ForbiddenException } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";
import { PgDialect } from "drizzle-orm/pg-core";

import { SlackConversationsController } from "./slack-conversations.controller";
import { SlackConversationsRepository } from "./slack-conversations.repository";
import { slackConversationSchema } from "./slack-conversations.schema";

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
  threadKey: "pairing:workspace:channel:thread",
  messages: [
    {
      externalId: "1",
      role: "user" as const,
      text: "Hello",
      slackUserId: "U123",
      slackUserName: "Anna",
      createdAt: "2026-10-29T10:00:00Z",
    },
  ],
};

describe("Slack transcript boundaries", () => {
  it("allows only the explicit student grant and passes the authenticated actor", async () => {
    const append = jest.fn().mockResolvedValue({ id: "thread" });
    const controller = new SlackConversationsController({
      append,
    } as unknown as SlackConversationsRepository);
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
    expect(Value.Check(slackConversationSchema, input)).toBe(true);
    expect(Value.Check(slackConversationSchema, { ...input, messages: [] })).toBe(false);
    expect(
      Value.Check(slackConversationSchema, {
        ...input,
        messages: [{ ...input.messages[0], role: "system" }],
      }),
    ).toBe(false);
    expect(Value.Check(slackConversationSchema, { ...input, threadKey: "a".repeat(501) })).toBe(
      false,
    );
  });

  it("rejects an archived, deleted or absent account before importing messages", async () => {
    const where = jest.fn().mockReturnValue({limit: jest.fn().mockResolvedValue([])});
    const db = {select: jest.fn().mockReturnValue({from: jest.fn().mockReturnValue({where})}), insert: jest.fn()};
    const runner = {runWithTenantTransaction: jest.fn(async (_tenant, fn) => fn())};
    const repository = new SlackConversationsRepository(db as never, runner as never);
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
    const repository = new SlackConversationsRepository(db as never, runner as never);
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
        slackUserId: "U123",
        slackUserName: "Anna",
      }),
    ]);
    expect(threadConflict.mock.calls[0][0].target).toHaveLength(4);
    expect(messageConflict.mock.calls[0][0].target).toHaveLength(3);
  });
});
