import {
  areMcpScopeSetsEqual,
  canUseMcpToolWithScopes,
  isMcpScopeSet,
  isRequestableMcpScopeSet,
  MCP_SCOPES,
  parseMcpScopes,
} from "./mcp-tool-scope";

describe("MCP integration scope policy", () => {
  it.each([MCP_SCOPES.SEARCH, MCP_SCOPES.SEARCH_READ])(
    "allows only global search with %s",
    (scope) => {
      expect(canUseMcpToolWithScopes("global_search", [scope])).toBe(true);
      expect(canUseMcpToolWithScopes("get_course", [scope])).toBe(false);
      expect(canUseMcpToolWithScopes("create_course", [scope])).toBe(false);
    },
  );

  it("exposes learner equivalents without management or lesson access", () => {
    for (const tool of [
      "global_search",
      "list_student_courses",
      "get_student_course",
      "list_student_articles",
      "get_student_article",
      "list_student_news",
      "get_student_news",
      "list_student_qa_entries",
      "get_student_qa_entry",
    ])
      expect(canUseMcpToolWithScopes(tool, [MCP_SCOPES.STUDENT_READ])).toBe(true);
    for (const tool of [
      "list_courses",
      "get_course",
      "get_lesson",
      "list_users",
      "get_my_capabilities",
      "request_generic_file_upload",
      "create_course",
    ])
      expect(canUseMcpToolWithScopes(tool, [MCP_SCOPES.STUDENT_READ])).toBe(false);
  });

  it("preserves a frozen legacy authoring catalog without implicitly adding new tools", () => {
    expect(canUseMcpToolWithScopes("create_course", [MCP_SCOPES.AUTHORING])).toBe(true);
    expect(canUseMcpToolWithScopes("global_search", [MCP_SCOPES.AUTHORING])).toBe(true);
    expect(canUseMcpToolWithScopes("get_student_course", [MCP_SCOPES.AUTHORING])).toBe(false);
    expect(canUseMcpToolWithScopes("unknown", [MCP_SCOPES.AUTHORING])).toBe(false);
  });

  it("combines granular scopes but never assumes write grants read", () => {
    const scopes = [MCP_SCOPES.COURSES_READ, MCP_SCOPES.ARTICLES_WRITE];
    expect(canUseMcpToolWithScopes("get_course", scopes)).toBe(true);
    expect(canUseMcpToolWithScopes("create_article", scopes)).toBe(true);
    expect(canUseMcpToolWithScopes("create_course", scopes)).toBe(false);
    expect(canUseMcpToolWithScopes("get_article", scopes)).toBe(false);
    expect(canUseMcpToolWithScopes("global_search", scopes)).toBe(false);
  });

  it("requires explicit files scope for upload grants", () => {
    expect(canUseMcpToolWithScopes("request_course_upload", [MCP_SCOPES.COURSES_WRITE])).toBe(
      false,
    );
    expect(canUseMcpToolWithScopes("request_course_upload", [MCP_SCOPES.FILES_WRITE])).toBe(true);
  });

  it("recognizes legacy grants without allowing new consent for them", () => {
    for (const scope of [MCP_SCOPES.AUTHORING, MCP_SCOPES.SEARCH]) {
      expect(isMcpScopeSet([scope])).toBe(true);
      expect(isRequestableMcpScopeSet([scope])).toBe(false);
    }
  });

  it.each([
    undefined,
    null,
    "search",
    [],
    ["admin"],
    ["search", "authoring"],
    ["courses:read", "courses:read"],
    ["student:read", "courses:read"],
    ["authoring", "courses:read"],
    ["toString"],
    [1],
  ])("fails closed for invalid scope sets %p", (scopes) => {
    expect(isMcpScopeSet(scopes)).toBe(false);
    expect(canUseMcpToolWithScopes("global_search", scopes)).toBe(false);
    expect(canUseMcpToolWithScopes("create_course", scopes)).toBe(false);
  });

  it("compares validated scope sets independent of ordering without dropping duplicates", () => {
    expect(
      areMcpScopeSetsEqual(parseMcpScopes("courses:read articles:read"), [
        "articles:read",
        "courses:read",
      ]),
    ).toBe(true);
    expect(areMcpScopeSetsEqual(["courses:read"], ["courses:read", "courses:write"])).toBe(false);
    expect(areMcpScopeSetsEqual(["courses:read", "courses:read"], ["courses:read"])).toBe(false);
  });
});
