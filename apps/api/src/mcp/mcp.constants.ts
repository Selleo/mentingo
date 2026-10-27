export const MCP_SERVER_NAME = "mentingo";
export const MCP_SERVER_VERSION = "0.1.0";

export const MCP_READ_VIEWS = {
  LEARNER: "learner",
  MANAGEMENT_SEARCH: "managementSearch",
} as const;
export type McpReadView = (typeof MCP_READ_VIEWS)[keyof typeof MCP_READ_VIEWS];
