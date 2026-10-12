import type { PermissionKey } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";

/** Runs an operation with the bound MCP actor's current permissions and audit context. */
export type McpToolRunner = <T extends Record<string, unknown>>(
  requiredPermissions: PermissionKey[],
  operation: (user: CurrentUserType) => Promise<T>,
) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}>;
