import { propagateAttributes, startObservation } from "@langfuse/tracing";

import type { McpCallContext, McpToolActor } from "./mcp.types";
import type { CallToolResult } from "@modelcontextprotocol/server";

/** Redact credentials, including the JSON text copy of MCP structured responses. */
export function mcpTracePayload(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value ?? null, (key, item) => {
      if (/token|authorization|cookie|secret|password|signature|api[-_]?key/i.test(key))
        return "[REDACTED]";
      if (typeof item !== "string") return item;
      try {
        if (/^\s*[\[{]/.test(item)) return mcpTracePayload(JSON.parse(item));
      } catch {
        // Plain text may start with a brace without containing valid JSON.
      }
      return item.replace(/https?:\/\/[^\s"<>]+/g, (url) => url.split(/[?#]/)[0]);
    }),
  );
}

export function traceMcpTool(
  name: string,
  actor: McpToolActor,
  call: McpCallContext | undefined,
  input: unknown,
  operation: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  return propagateAttributes(
    {
      userId: `${actor.grant.tenantId}:${actor.grant.userId}`,
      sessionId: `mcp:${actor.grant.tenantId}:${actor.grant.userId}:${
        actor.grant.clientId
      }:${new Date().toISOString().slice(0, 10)}`,
      metadata: { clientId: actor.grant.clientId, requestId: call?.requestId ?? "" },
    },
    async () => {
      const span = startObservation(
        `mcp.${name}`,
        { input: mcpTracePayload(input) },
        { asType: "tool" },
      );
      try {
        const result = await operation();
        span.update({
          output: mcpTracePayload(result),
          level: result.isError ? "ERROR" : "DEFAULT",
        });
        return result;
      } catch (error) {
        span.update({ level: "ERROR", statusMessage: "MCP tool failed" });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
