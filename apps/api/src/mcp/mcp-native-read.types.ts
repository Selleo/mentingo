import { MCP_HELPDESK_TOOL_NAMES } from "./mcp-self-onboarding.constants";

import type { McpToolActor, McpNativeFeatureCapabilities } from "./mcp.types";

/** A native session is never represented as an OAuth grant. */
export type NativeReadActor = {
  onAuthorizedTool?: () => Promise<void>;
  native: { userId: string; tenantId: string; email: string; resource: string };
};
export type BoundToolActor = McpToolActor | NativeReadActor;
export function bindToolActor(actor: BoundToolActor) {
  if ("native" in actor)
    return { ...actor.native, clientId: "native-assistant", scopes: [] as string[] };
  return { ...actor.grant, email: actor.email };
}
export type NativeReadTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};
export const NATIVE_READ_TOOL_NAMES = new Set([
  "get_my_capabilities",
  ...Object.values(MCP_HELPDESK_TOOL_NAMES),
  "global_search",
  "list_courses",
  "get_course",
  "get_course_settings",
  "list_course_languages",
  "list_course_group_deadlines",
  "list_chapters",
  "get_chapter",
  "list_lessons",
  "get_lesson",
  "search_lessons",
  "list_lesson_resources",
  "list_categories",
  "get_category",
  "list_course_categories",
  "list_development_paths",
  "get_development_path",
  "list_development_path_courses",
  "list_qa_entries",
  "get_qa_entry",
  "list_article_sections",
  "get_article_section",
  "list_articles",
  "get_article",
  "list_news",
  "get_news",
  "get_my_user",
  "get_my_user_details",
  "list_users",
  "get_user",
  "get_user_details",
  "list_user_roles",
  "list_groups",
  "get_group",
  "list_user_groups",
  "list_course_groups",
]);

export type NativeReadSchemaAdapter = {
  "~standard": {
    jsonSchema: { input: () => Record<string, unknown> };
    validate: (
      value: unknown,
    ) => Promise<{ value?: unknown; issues?: unknown }> | { value?: unknown; issues?: unknown };
  };
};
export type NativeReadRegistration = {
  name: string;
  config: { description?: string; inputSchema: NativeReadSchemaAdapter };
  callback: (input: unknown) => Promise<import("@modelcontextprotocol/server").CallToolResult>;
  enabled: boolean;
};

/** Capability preflight must be complete boolean metadata before it can reach the model. */
export function isMcpNativeFeatureCapabilities(
  value: unknown,
): value is McpNativeFeatureCapabilities {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const features = value as Record<string, unknown>;
  return ["articles", "news", "qa", "developmentPaths"].every((name) => {
    const feature = features[name];
    if (!feature || typeof feature !== "object" || Array.isArray(feature)) return false;
    const access = feature as Record<string, unknown>;
    return ["enabled", "canList", "canRead"].every((field) => typeof access[field] === "boolean");
  });
}
