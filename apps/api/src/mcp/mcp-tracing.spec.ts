jest.mock("@langfuse/tracing", () => ({
  startObservation: jest.fn(),
  propagateAttributes: jest.fn((_attributes, operation) => operation()),
}));

import { propagateAttributes, startObservation } from "@langfuse/tracing";

import { mcpTracePayload, traceMcpTool } from "./mcp-tracing";

import type { McpToolActor } from "./mcp.types";

const actor = {
  grant: { tenantId: "tenant", userId: "user", clientId: "oauth-client" },
} as McpToolActor;

describe("MCP tool tracing", () => {
  const span = { update: jest.fn(), end: jest.fn() };

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-10-16T12:00:00Z") });
    jest.clearAllMocks();
    jest.mocked(startObservation).mockReturnValue(span as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("records scoped identity, arguments and response without changing the result", async () => {
    const result = { content: [], structuredContent: { id: "course" } };
    const operation = jest.fn().mockResolvedValue(result);
    await expect(
      traceMcpTool(
        "get_course",
        actor,
        { requestId: "rpc", tool: "get_course", arguments: {} },
        { id: "course" },
        operation,
      ),
    ).resolves.toBe(result);
    expect(propagateAttributes).toHaveBeenCalledWith(
      {
        userId: "tenant:user",
        sessionId: "mcp:tenant:user:oauth-client:2026-10-16",
        metadata: { clientId: "oauth-client", requestId: "rpc" },
      },
      expect.any(Function),
    );
    expect(startObservation).toHaveBeenCalledWith(
      "mcp.get_course",
      { input: { id: "course" } },
      { asType: "tool" },
    );
    expect(operation).toHaveBeenCalledTimes(1);
    expect(span.update).toHaveBeenCalledWith({ output: result, level: "DEFAULT" });
    expect(span.end).toHaveBeenCalledTimes(1);
  });

  it("groups different tool calls within a UTC day and rolls over at UTC midnight", async () => {
    const operation = async () => ({ content: [] });
    jest.setSystemTime(new Date("2026-10-16T00:00:00Z"));
    await traceMcpTool("list_courses", actor, undefined, {}, operation);
    jest.setSystemTime(new Date("2026-10-16T23:59:59.999Z"));
    await traceMcpTool("get_course", actor, undefined, {}, operation);
    jest.setSystemTime(new Date("2026-10-17T00:00:00Z"));
    await traceMcpTool("get_course", actor, undefined, {}, operation);

    expect(
      jest.mocked(propagateAttributes).mock.calls.map(([attributes]) => attributes.sessionId),
    ).toEqual([
      "mcp:tenant:user:oauth-client:2026-10-16",
      "mcp:tenant:user:oauth-client:2026-10-16",
      "mcp:tenant:user:oauth-client:2026-10-17",
    ]);
  });

  it.each([
    ["tenantId", "other-tenant", "mcp:other-tenant:user:oauth-client:2026-10-16"],
    ["userId", "other-user", "mcp:tenant:other-user:oauth-client:2026-10-16"],
    ["clientId", "other-client", "mcp:tenant:user:other-client:2026-10-16"],
  ])("separates daily sessions by %s", async (field, value, sessionId) => {
    const otherActor = { ...actor, grant: { ...actor.grant, [field]: value } };
    await traceMcpTool("get_course", otherActor, undefined, {}, async () => ({ content: [] }));
    expect(propagateAttributes).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId }),
      expect.any(Function),
    );
  });

  it("marks returned MCP errors and ends the observation", async () => {
    const result = { content: [], isError: true };
    await traceMcpTool("get_course", actor, undefined, {}, async () => result);
    expect(span.update).toHaveBeenCalledWith({ output: result, level: "ERROR" });
    expect(span.end).toHaveBeenCalledTimes(1);
  });

  it("preserves thrown errors without recording their potentially sensitive message", async () => {
    const error = new Error("secret");
    await expect(
      traceMcpTool("get_course", actor, undefined, {}, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(span.update).toHaveBeenCalledWith({ level: "ERROR", statusMessage: "MCP tool failed" });
    expect(span.end).toHaveBeenCalledTimes(1);
  });

  it("preserves ordinary text and string IDs", () => {
    expect(mcpTracePayload({ id: "123", text: "true", body: "{plain text" })).toEqual({
      id: "123",
      text: "true",
      body: "{plain text",
    });
  });

  it("redacts upload credentials in structured and JSON text responses without mutating them", () => {
    const payload = {
      token: "secret",
      uploadRequest: { headers: { Authorization: "Bearer secret" } },
      url: "https://files.example/file?signature=secret",
    };
    const result = {
      structuredContent: payload,
      content: [{ type: "text", text: JSON.stringify(payload) }],
    };
    const redacted = {
      token: "[REDACTED]",
      uploadRequest: { headers: { Authorization: "[REDACTED]" } },
      url: "https://files.example/file",
    };
    expect(mcpTracePayload(result)).toEqual({
      structuredContent: redacted,
      content: [{ type: "text", text: redacted }],
    });
    expect(payload.token).toBe("secret");
  });
});
