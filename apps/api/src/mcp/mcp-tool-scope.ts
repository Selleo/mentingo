/** Integration scopes narrow the existing account permissions; they never grant access. */
export const MCP_SCOPES = {
  AUTHORING: "authoring",
  SEARCH: "search",
} as const;

export function isMcpScopeSet(scopes: unknown): scopes is string[] {
  return (
    Array.isArray(scopes) &&
    scopes.length === 1 &&
    (scopes[0] === MCP_SCOPES.AUTHORING || scopes[0] === MCP_SCOPES.SEARCH)
  );
}

export function canUseMcpToolWithScopes(name: string, scopes: unknown): boolean {
  if (!isMcpScopeSet(scopes)) return false;
  if (scopes[0] === MCP_SCOPES.AUTHORING) return true;
  return name === "global_search";
}
