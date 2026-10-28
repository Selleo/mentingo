/** Public product guidance is distinct from tenant-owned learning content. */
export const MCP_HELPDESK_TOOL_NAMES = {
  SEARCH: "search_helpdesk",
  TUTORIAL: "get_helpdesk_tutorial",
} as const;

export const MCP_HELPDESK_GUIDANCE_KIND = "product_guidance";

export function isMcpHelpdeskTool(name: string): boolean {
  return Object.values(MCP_HELPDESK_TOOL_NAMES).some((tool) => tool === name);
}
