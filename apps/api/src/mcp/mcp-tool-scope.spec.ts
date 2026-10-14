import { canUseMcpToolWithScopes, isMcpScopeSet, MCP_SCOPES } from "./mcp-tool-scope";

describe("MCP integration scope policy", () => {
  it("allows only content search with a search grant", () => {
    expect(canUseMcpToolWithScopes("global_search", [MCP_SCOPES.SEARCH])).toBe(true);
    for (const tool of [
      "create_course",
      "list_users",
      "get_lesson",
      "get_my_capabilities",
      "unknown",
    ])
      expect(canUseMcpToolWithScopes(tool, [MCP_SCOPES.SEARCH])).toBe(false);
  });

  it("preserves the authoring catalog without replacing account authorization", () => {
    expect(canUseMcpToolWithScopes("create_course", [MCP_SCOPES.AUTHORING])).toBe(true);
    expect(canUseMcpToolWithScopes("global_search", [MCP_SCOPES.AUTHORING])).toBe(true);
  });

  it("fails closed for missing, unknown or combined scopes", () => {
    for (const scopes of [
      undefined,
      null,
      "search",
      [],
      ["admin"],
      ["search", "authoring"],
      ["search", "search"],
    ]) {
      expect(isMcpScopeSet(scopes)).toBe(false);
      expect(canUseMcpToolWithScopes("global_search", scopes)).toBe(false);
      expect(canUseMcpToolWithScopes("create_course", scopes)).toBe(false);
    }
  });
});
