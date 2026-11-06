export const MCP_SERVER_NAME = "mentingo";
export const MCP_SERVER_VERSION = "0.1.0";

export const MCP_READ_VIEWS = {
  LEARNER: "learner",
  MANAGEMENT_SEARCH: "managementSearch",
} as const;
export type McpReadView = (typeof MCP_READ_VIEWS)[keyof typeof MCP_READ_VIEWS];

export const MCP_TOOL_ERROR_CODES = {
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INTERNAL: "INTERNAL",
} as const;
export type McpToolErrorCode = (typeof MCP_TOOL_ERROR_CODES)[keyof typeof MCP_TOOL_ERROR_CODES];
