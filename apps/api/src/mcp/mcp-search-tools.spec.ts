import { PERMISSIONS, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { REQUIRED_PERMISSIONS_KEY } from "src/common/decorators/require-permission.decorator";
import { GlobalSearchController } from "src/global-search/global-search.controller";

import { shapeMcpSearchResults } from "./mcp-search-results";
import {
  globalSearchInputSchema,
  MCP_GLOBAL_SEARCH_PERMISSIONS,
  MCP_CONTENT_SEARCH_PERMISSIONS,
  registerMcpSearchTools,
} from "./mcp-search-tools";
import { canListMcpTool } from "./mcp-tool-access";

import type { McpToolRunner } from "./mcp-tool-runner.types";
import type { McpServer } from "@modelcontextprotocol/server";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { GlobalSearchService } from "src/global-search/global-search.service";
import type { GlobalSearchResponse } from "src/global-search/schemas/global-search.schema";
import type { SettingsService } from "src/settings/settings.service";

const settings = {} as Awaited<ReturnType<SettingsService["getGlobalSettings"]>>;

describe("MCP global search", () => {
  it("uses exactly the REST search permission alternatives", () => {
    expect(MCP_GLOBAL_SEARCH_PERMISSIONS).toEqual(
      Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, GlobalSearchController.prototype.search),
    );
  });

  it("limits SEARCH permission alternatives to supported content, excluding directory/path-only roles", () => {
    const directoryPermissions = new Set<string>([
      PERMISSIONS.LEARNING_PATH_READ,
      PERMISSIONS.USER_MANAGE,
      PERMISSIONS.CATEGORY_READ,
      PERMISSIONS.CATEGORY_MANAGE,
      PERMISSIONS.GROUP_READ,
      PERMISSIONS.GROUP_MANAGE,
    ]);
    expect(MCP_CONTENT_SEARCH_PERMISSIONS).toEqual(
      MCP_GLOBAL_SEARCH_PERMISSIONS.filter((permission) => !directoryPermissions.has(permission)),
    );
    expect(MCP_CONTENT_SEARCH_PERMISSIONS).not.toContain(PERMISSIONS.USER_MANAGE);
    expect(MCP_CONTENT_SEARCH_PERMISSIONS).toContain(PERMISSIONS.COURSE_READ_ASSIGNED);
  });

  it("advertises search for readers and hides it without search permissions", () => {
    expect(canListMcpTool("global_search", [PERMISSIONS.COURSE_READ_ASSIGNED], settings)).toBe(
      true,
    );
    expect(canListMcpTool("global_search", [PERMISSIONS.USER_MANAGE], settings)).toBe(true);
    expect(canListMcpTool("global_search", [], settings)).toBe(false);
    expect(canListMcpTool("global_search", [PERMISSIONS.SETTINGS_MANAGE], settings)).toBe(false);
  });

  it("requires a supported language and bounded query, rejecting additional arguments", () => {
    const valid = { searchQuery: "onboarding", language: SUPPORTED_LANGUAGES.PL };
    expect(Value.Check(globalSearchInputSchema, valid)).toBe(true);
    expect(Value.Check(globalSearchInputSchema, { ...valid, mode: "hybrid" })).toBe(true);
    expect(Value.Check(globalSearchInputSchema, { ...valid, mode: "keyword" })).toBe(true);
    for (const args of [
      { searchQuery: "onboarding" },
      { ...valid, language: "xx" },
      { ...valid, searchQuery: "ab" },
      { ...valid, searchQuery: "a".repeat(501) },
      { ...valid, userId: "someone-else" },
      { ...valid, resource: "https://attacker.example/mcp" },
      { ...valid, mode: "semantic" },
    ])
      expect(Value.Check(globalSearchInputSchema, args)).toBe(false);
  });

  it("passes the authenticated actor and requested language through the authorized runner", async () => {
    const registerTool = jest.fn();
    const server = { registerTool } as unknown as McpServer;
    const user = {
      userId: "actor-id",
      tenantId: "tenant-id",
      email: "actor@example.test",
      roleSlugs: [],
      permissions: [PERMISSIONS.COURSE_READ_ASSIGNED],
    } as CurrentUserType;
    const result: GlobalSearchResponse = {
      myCourses: [{ id: "course-id", title: "Onboarding" }],
      allCourses: [],
      availableCourses: [],
      lessons: [],
      learningPaths: [],
      news: [],
      articles: [],
      qa: [],
      users: [],
      categories: [],
      groups: [],
    };
    const context = { resource: "https://tenant.example/mcp", searchOnly: false };
    const search = jest.fn().mockResolvedValue(result);
    const run = jest.fn(async (_permissions, operation) => ({
      content: [],
      structuredContent: await operation(user),
    }));
    registerMcpSearchTools(
      server,
      run as McpToolRunner,
      { search } as unknown as GlobalSearchService,
      context,
    );
    const [name, config, handler] = registerTool.mock.calls[0];
    expect(name).toBe("global_search");
    expect(config.annotations.readOnlyHint).toBe(true);
    expect(await handler({ searchQuery: "onboarding", language: SUPPORTED_LANGUAGES.DE })).toEqual({
      content: [],
      structuredContent: shapeMcpSearchResults(result, context),
    });
    expect(run).toHaveBeenCalledWith(MCP_GLOBAL_SEARCH_PERMISSIONS, expect.any(Function));
    expect(search).toHaveBeenCalledWith("onboarding", SUPPORTED_LANGUAGES.DE, user);
    await handler({ searchQuery: "onboarding", language: SUPPORTED_LANGUAGES.PL, mode: "hybrid" });
    expect(search).toHaveBeenLastCalledWith("onboarding", SUPPORTED_LANGUAGES.PL, user, "hybrid");
    registerMcpSearchTools(
      server,
      run as McpToolRunner,
      { search } as unknown as GlobalSearchService,
      { ...context, searchOnly: true },
    );
    const searchHandler = registerTool.mock.calls[1][2];
    await searchHandler({ searchQuery: "onboarding", language: SUPPORTED_LANGUAGES.DE });
    expect(run).toHaveBeenLastCalledWith(MCP_CONTENT_SEARCH_PERMISSIONS, expect.any(Function));
  });
});
