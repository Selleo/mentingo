import { Type, type Static } from "@sinclair/typebox";

import { MCP_SCOPES } from "./mcp-tool-scope";

export const mcpConsentDetailsSchema = Type.Object({
  clientName: Type.String(),
  clientId: Type.String(),
  redirectUri: Type.String(),
  accountEmail: Type.String(),
  scopes: Type.Array(Type.Enum(MCP_SCOPES), { minItems: 1, uniqueItems: true }),
});

export type McpConsentDetails = Static<typeof mcpConsentDetailsSchema>;

export const mcpConsentIdSchema = Type.String({
  minLength: 43,
  maxLength: 43,
  pattern: "^[A-Za-z0-9_-]+$",
});
