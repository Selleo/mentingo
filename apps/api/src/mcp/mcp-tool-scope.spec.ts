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

  it("exposes learner content and curriculum without management access", () => {
    for (const tool of [
      "global_search",
      "list_courses",
      "get_course",
      "list_chapters",
      "get_chapter",
      "list_lessons",
      "get_lesson",
      "search_lessons",
      "list_articles",
      "get_article",
      "list_news",
      "get_news",
      "list_qa_entries",
      "get_qa_entry",
    ])
      expect(canUseMcpToolWithScopes(tool, [MCP_SCOPES.STUDENT_READ])).toBe(true);
    for (const tool of [
      "list_users",
      "get_my_capabilities",
      "request_generic_file_upload",
      "create_course",
    ])
      expect(canUseMcpToolWithScopes(tool, [MCP_SCOPES.STUDENT_READ])).toBe(false);
  });

  it.each([MCP_SCOPES.ACCOUNT_ACCESS, MCP_SCOPES.COURSES_READ])(
    "includes learner lesson search in %s",
    (scope) => expect(canUseMcpToolWithScopes("search_lessons", [scope])).toBe(true),
  );
  it.each([MCP_SCOPES.SEARCH_READ, MCP_SCOPES.AUTHORING])(
    "preserves narrow and legacy %s catalogs",
    (scope) => expect(canUseMcpToolWithScopes("search_lessons", [scope])).toBe(false),
  );

  it("preserves a frozen legacy authoring catalog without implicitly adding new tools", () => {
    expect(canUseMcpToolWithScopes("create_course", [MCP_SCOPES.AUTHORING])).toBe(true);
    expect(canUseMcpToolWithScopes("global_search", [MCP_SCOPES.AUTHORING])).toBe(true);
    expect(canUseMcpToolWithScopes("get_course", [MCP_SCOPES.AUTHORING])).toBe(true);
    expect(canUseMcpToolWithScopes("unknown", [MCP_SCOPES.AUTHORING])).toBe(false);
  });

  it("allows general access only to the reviewed catalog", () => {
    expect(isRequestableMcpScopeSet([MCP_SCOPES.ACCOUNT_ACCESS])).toBe(true);
    for (const name of ["get_course", "create_course", "get_my_capabilities", "global_search"])
      expect(canUseMcpToolWithScopes(name, [MCP_SCOPES.ACCOUNT_ACCESS])).toBe(true);
    expect(canUseMcpToolWithScopes("unknown", [MCP_SCOPES.ACCOUNT_ACCESS])).toBe(false);
    expect(canUseMcpToolWithScopes("get_student_course", [MCP_SCOPES.ACCOUNT_ACCESS])).toBe(false);
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
    ["account:access", "courses:read"],
    ["account:access", "student:read"],
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
