import { PERMISSIONS, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { REQUIRED_PERMISSIONS_KEY } from "src/common/decorators/require-permission.decorator";
import { GlobalSearchController } from "src/global-search/global-search.controller";

import {
  globalSearchInputSchema,
  MCP_GLOBAL_SEARCH_PERMISSIONS,
  registerMcpSearchTools,
} from "./mcp-search-tools";
import { canListMcpTool } from "./mcp-tool-access";

import type { McpToolRunner } from "./mcp-tool-runner.types";
import type { McpServer } from "@modelcontextprotocol/server";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { GlobalSearchService } from "src/global-search/global-search.service";
import type { SettingsService } from "src/settings/settings.service";

const settings = {} as Awaited<ReturnType<SettingsService["getGlobalSettings"]>>;

describe("MCP global search", () => {
  it("uses exactly the REST search permission alternatives", () => {
    expect(MCP_GLOBAL_SEARCH_PERMISSIONS).toEqual(
      Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, GlobalSearchController.prototype.search),
    );
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
    for (const args of [
      { searchQuery: "onboarding" },
      { ...valid, language: "xx" },
      { ...valid, searchQuery: "ab" },
      { ...valid, searchQuery: "a".repeat(501) },
      { ...valid, userId: "someone-else" },
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
    const result = { myCourses: [{ id: "course-id", title: "Onboarding" }] };
    const search = jest.fn().mockResolvedValue(result);
    const run = jest.fn(async (_permissions, operation) => ({
      content: [],
      structuredContent: await operation(user),
    }));
    registerMcpSearchTools(
      server,
      run as McpToolRunner,
      { search } as unknown as GlobalSearchService,
    );
    const [name, config, handler] = registerTool.mock.calls[0];
    expect(name).toBe("global_search");
    expect(config.annotations.readOnlyHint).toBe(true);
    expect(await handler({ searchQuery: "onboarding", language: SUPPORTED_LANGUAGES.DE })).toEqual({
      content: [],
      structuredContent: result,
    });
    expect(run).toHaveBeenCalledWith(MCP_GLOBAL_SEARCH_PERMISSIONS, expect.any(Function));
    expect(search).toHaveBeenCalledWith("onboarding", SUPPORTED_LANGUAGES.DE, user);
  });
});
