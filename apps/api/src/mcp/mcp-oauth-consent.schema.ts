import { Type, type Static } from "@sinclair/typebox";

export const mcpConsentDetailsSchema = Type.Object({
  clientName: Type.String(),
  accountEmail: Type.String(),
});

export type McpConsentDetails = Static<typeof mcpConsentDetailsSchema>;

export const mcpConsentIdSchema = Type.String({
  minLength: 43,
  maxLength: 43,
  pattern: "^[A-Za-z0-9_-]+$",
});
