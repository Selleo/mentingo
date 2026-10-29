import { UnauthorizedException } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";

import { assistantThreads, assistantMessages } from "src/storage/schema";

import { ExternalConversationsController } from "./external-conversations.controller";
import { ExternalConversationsRepository } from "./external-conversations.repository";
import { externalConversationSchema } from "./external-conversations.schema";

import type { ExternalConversationRequest } from "./external-conversations.types";

const input = {integrationId: "installation-1", source: "slack" as const, threadKey: "workspace:channel:thread", messages: [{externalId: "1", role: "user" as const, text: "Hello", participantId: "U123", participantName: "Anna", createdAt: "2026-10-29T10:00:00Z"}]};

describe("External integration transcript ingestion", () => {
  it("uses the signature-verified tenant without a paired account", async () => {
    const append = jest.fn().mockResolvedValue({id: "thread"});
    const controller = new ExternalConversationsController({append} as unknown as ExternalConversationsRepository);
    await controller.append(input, {externalConversationResource: {tenantId: "tenant"}} as ExternalConversationRequest);
    expect(append).toHaveBeenCalledWith("tenant", input);
  });

  it("rejects ingestion without a verified tenant before writing", async () => {
    const append = jest.fn();
    const controller = new ExternalConversationsController({
      append,
    } as unknown as ExternalConversationsRepository);
    await expect(controller.append(input, {} as ExternalConversationRequest)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(append).not.toHaveBeenCalled();
  });

  it("validates source, installation identity, bounds and visible message roles", () => {
    for (const source of ["slack", "discord", "whatsapp"]) expect(Value.Check(externalConversationSchema, {...input, source})).toBe(true);
    for (const source of ["mentingo", "unknown"]) expect(Value.Check(externalConversationSchema, {...input, source})).toBe(false);
    for (const patch of [{integrationId: ""}, {integrationId: "a".repeat(201)}, {messages: []}, {threadKey: "a".repeat(501)}, {messages: [{...input.messages[0], role: "system"}]}]) expect(Value.Check(externalConversationSchema, {...input, ...patch})).toBe(false);
    const missing = {...input}; Reflect.deleteProperty(missing, "integrationId");
    expect(Value.Check(externalConversationSchema, missing)).toBe(false);
  });

  it("namespaces thread retries by tenant, integration, source and thread and keeps message uniqueness", async () => {
    const threadConflict = jest.fn().mockReturnValue({returning: jest.fn().mockResolvedValue([{id: "thread"}])});
    const messageConflict = jest.fn().mockResolvedValue(undefined);
    const threadValues = jest.fn().mockReturnValue({onConflictDoUpdate: threadConflict});
    const messageValues = jest.fn().mockReturnValue({onConflictDoNothing: messageConflict});
    const db = {insert: jest.fn().mockReturnValueOnce({values: threadValues}).mockReturnValueOnce({values: messageValues})};
    const runner = {runWithTenantTransaction: jest.fn(async (_tenant, fn) => fn())};
    await new ExternalConversationsRepository(db as never, runner as never).append("tenant", input);
    expect(runner.runWithTenantTransaction).toHaveBeenCalledWith("tenant", expect.any(Function));
    expect(threadValues).toHaveBeenCalledWith(expect.objectContaining({tenantId: "tenant", externalIntegrationId: "installation-1", source: "slack", externalThreadKey: input.threadKey}));
    expect(threadValues.mock.calls[0][0]).not.toHaveProperty("userId");
    expect(threadConflict.mock.calls[0][0].target).toEqual([assistantThreads.tenantId, assistantThreads.externalIntegrationId, assistantThreads.source, assistantThreads.externalThreadKey]);
    expect(messageConflict.mock.calls[0][0].target).toEqual([assistantMessages.tenantId, assistantMessages.threadId, assistantMessages.externalMessageId]);
    expect(messageValues).toHaveBeenCalledWith([expect.objectContaining({externalUserId: "U123", externalUserName: "Anna"})]);
  });
});
