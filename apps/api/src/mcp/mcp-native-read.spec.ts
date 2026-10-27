import { AsyncLocalStorage } from "node:async_hooks";

import { FEATURES, FEATURE_SETTINGS_KEYS, PERMISSIONS } from "@repo/shared";

import { collectAssistantSources, groundAssistantText } from "src/assistant/assistant-links";
import { dbAls } from "src/storage/db/db-als.store";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { McpHttpService } from "./mcp-http.service";
import {
  NATIVE_READ_TOOL_NAMES,
  bindToolActor,
  isMcpNativeFeatureCapabilities,
} from "./mcp-native-read.types";
import { MCP_SCOPES } from "./mcp-tool-scope";

import type { McpCallContext, McpNativeFeatureCapabilities } from "./mcp.types";

describe("Native assistant read adapter", () => {
  const tenantId = "aa22c376-2adf-4236-a9c0-6361b6aec3c0";
  const userId = "bb22c376-2adf-4236-a9c0-6361b6aec3c0";
  let service: McpHttpService;
  let permissions: string[];
  let search: jest.Mock;
  let findActiveAccount: jest.Mock;
  let featureSettings: Record<string, boolean>;

  beforeEach(() => {
    permissions = [PERMISSIONS.COURSE_READ];
    featureSettings = {};
    search = jest.fn().mockResolvedValue({
      allCourses: [],
      myCourses: [],
      availableCourses: [],
      news: [],
      articles: [],
      qa: [],
      lessons: [],
      learningPaths: [],
      users: [],
      groups: [],
      categories: [],
      searchMode: "keyword",
      semanticStatus: "disabled",
    });
    findActiveAccount = jest.fn().mockResolvedValue({ email: "learner@example.com" });
    service = Object.create(McpHttpService.prototype) as McpHttpService;
    Object.assign(service, {
      callContext: new AsyncLocalStorage<McpCallContext>(),
      mcpActorRepository: { findActiveAccount },
      tenantDbRunnerService: new TenantDbRunnerService({} as never),
      permissionsService: { getUserAccess: jest.fn(async () => ({ permissions, roleSlugs: [] })) },
      settingsService: { getGlobalSettings: jest.fn(async () => featureSettings) },
      globalSearchService: { search },
    });
  });

  const setModules = (enabled: boolean) => {
    featureSettings = {
      [FEATURE_SETTINGS_KEYS[FEATURES.ARTICLES]]: enabled,
      [FEATURE_SETTINGS_KEYS[FEATURES.NEWS]]: enabled,
      [FEATURE_SETTINGS_KEYS[FEATURES.QA]]: enabled,
      learningPathsEnabled: enabled,
    };
  };
  const capabilities = async () => {
    const result = await service.executeNativeReadTool(
      userId,
      tenantId,
      "https://tenant.example",
      "get_my_capabilities",
      {},
    );
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toStrictEqual(
      JSON.parse(JSON.stringify(result.structuredContent)),
    );
    const data = result.structuredContent;
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("Missing capability metadata");
    const features = Reflect.get(data, "features");
    if (!isMcpNativeFeatureCapabilities(features)) throw new Error("Malformed capability metadata");
    return {
      features,
      articles: Reflect.get(data, "articles"),
      news: Reflect.get(data, "news"),
      qa: Reflect.get(data, "qa"),
      developmentPaths: Reflect.get(data, "developmentPaths"),
    };
  };

  describe.each([
    { name: "administrator", management: true },
    { name: "learner", management: false },
  ])("native module capabilities for $name", ({ management }) => {
    it.each([true, false])(
      "matches the actual read catalog with modules enabled=%s",
      async (enabled) => {
        permissions = management
          ? Object.values(PERMISSIONS)
          : [
              PERMISSIONS.ARTICLE_READ_PUBLIC,
              PERMISSIONS.NEWS_READ_PUBLIC,
              PERMISSIONS.QA_READ_PUBLIC,
            ];
        setModules(enabled);
        const data = await capabilities();
        const expectedRead = { enabled, canList: enabled, canRead: enabled };
        const expectedPath = {
          enabled,
          canList: enabled && management,
          canRead: enabled && management,
        };
        expect(data.features).toEqual({
          articles: expectedRead,
          news: expectedRead,
          qa: expectedRead,
          developmentPaths: expectedPath,
        });
        expect(data.articles).toBe(enabled);
        expect(data.news).toBe(enabled);
        expect(data.qa).toBe(enabled);
        expect(data.developmentPaths).toBe(enabled && management);
        const names = (
          await service.listNativeReadTools(userId, tenantId, "https://tenant.example")
        ).map((tool) => tool.name);
        expect(names).toContain("get_my_capabilities");
        const features = data.features;
        for (const [feature, list, read] of [
          [features.articles, "list_articles", "get_article"],
          [features.news, "list_news", "get_news"],
          [features.qa, "list_qa_entries", "get_qa_entry"],
          [features.developmentPaths, "list_development_paths", "get_development_path"],
        ] satisfies [McpNativeFeatureCapabilities["articles"], string, string][]) {
          expect(names.includes(list)).toBe(feature.canList);
          expect(names.includes(read)).toBe(feature.canRead);
        }
      },
    );
  });

  it("distinguishes enabled modules without permitted readers from disabled modules", async () => {
    permissions = [];
    setModules(true);
    const data = await capabilities();
    expect(data.features).toEqual({
      articles: { enabled: true, canList: false, canRead: false },
      news: { enabled: true, canList: false, canRead: false },
      qa: { enabled: true, canList: false, canRead: false },
      developmentPaths: { enabled: true, canList: false, canRead: false },
    });
    expect(data.articles).toBe(false);
    expect(
      (await service.listNativeReadTools(userId, tenantId, "https://tenant.example")).map(
        (tool) => tool.name,
      ),
    ).toContain("get_my_capabilities");
  });

  it("uses fresh permissions and settings when reporting capabilities after discovery", async () => {
    permissions = Object.values(PERMISSIONS);
    setModules(true);
    expect((await capabilities()).articles).toBe(true);
    permissions = [];
    const getUserAccess = Reflect.get(service, "permissionsService").getUserAccess as jest.Mock;
    getUserAccess
      .mockResolvedValueOnce({ permissions: Object.values(PERMISSIONS), roleSlugs: [] })
      .mockResolvedValueOnce({ permissions: [], roleSlugs: [] });
    expect((await capabilities()).features).toEqual(
      expect.objectContaining({ articles: { enabled: true, canList: false, canRead: false } }),
    );
    permissions = Object.values(PERMISSIONS);
    const getGlobalSettings = Reflect.get(service, "settingsService")
      .getGlobalSettings as jest.Mock;
    const enabledSettings = featureSettings;
    setModules(false);
    getGlobalSettings.mockResolvedValueOnce(enabledSettings).mockResolvedValueOnce(featureSettings);
    expect((await capabilities()).features).toEqual(
      expect.objectContaining({ articles: { enabled: false, canList: false, canRead: false } }),
    );
    const names = (
      await service.listNativeReadTools(userId, tenantId, "https://tenant.example")
    ).map((tool) => tool.name);
    expect(names).not.toContain("get_article");
    expect(names).not.toContain("list_articles");
    expect(names).toContain("get_my_capabilities");
  });

  it("uses a native identity with no OAuth grant or granted scopes", () => {
    const actor = {
      native: {
        userId,
        tenantId,
        email: "learner@example.com",
        resource: "https://tenant.example",
      },
    };
    expect(bindToolActor(actor).scopes).toEqual([]);
    expect(actor).not.toHaveProperty("grant");
  });

  it("advertises only explicitly allowed reads, with learner lookup contracts", async () => {
    const tools = await service.listNativeReadTools(userId, tenantId, "https://tenant.example");
    expect(tools.map(({ name }) => name)).toContain("global_search");
    expect(tools.map(({ name }) => name)).toContain("get_lesson");
    expect(tools.every(({ name }) => NATIVE_READ_TOOL_NAMES.has(name))).toBe(true);
    expect(
      tools.some(
        ({ name }) =>
          name.startsWith("create_") || name.startsWith("update_") || name.startsWith("request_"),
      ),
    ).toBe(false);
    const lesson = tools.find(({ name }) => name === "get_lesson")!;
    expect(lesson.description).toContain("Excludes quiz answers");
  });

  it("exports plain JSON schemas that durable Workflow steps can serialize", async () => {
    const tools = await service.listNativeReadTools(userId, tenantId, "https://tenant.example");
    expect(tools.length).toBeGreaterThan(0);
    expect(tools).toStrictEqual(JSON.parse(JSON.stringify(tools)));
  });

  it("rechecks the active tenant-bound account before native reads", async () => {
    findActiveAccount.mockImplementation(async () => {
      expect(dbAls.getStore()?.tenantId).toBe(tenantId);
      return { email: "learner@example.com" };
    });
    await service.listNativeReadTools(userId, tenantId, "https://tenant.example");
    expect(findActiveAccount).toHaveBeenLastCalledWith(userId);
    findActiveAccount.mockResolvedValue(undefined);
    await expect(
      service.executeNativeReadTool(userId, tenantId, "https://tenant.example", "global_search", {
        searchQuery: "safety",
        language: "en",
      }),
    ).rejects.toThrow("common.toast.noAccess");
    expect(findActiveAccount).toHaveBeenCalledTimes(2);
    expect(search).not.toHaveBeenCalled();
  });

  it("denies writes even if an administrator requests one directly", async () => {
    permissions = Object.values(PERMISSIONS);
    await expect(
      service.executeNativeReadTool(
        userId,
        tenantId,
        "https://tenant.example",
        "create_course",
        {},
      ),
    ).rejects.toThrow("common.toast.noAccess");
    expect(search).not.toHaveBeenCalled();
  });

  it("rejects invalid native input before executing the authorized tool", async () => {
    await expect(
      service.executeNativeReadTool(userId, tenantId, "https://tenant.example", "global_search", {
        searchQuery: [],
        language: "en",
      }),
    ).rejects.toThrow("assistant.errors.invalidToolInput");
    expect(search).not.toHaveBeenCalled();
  });

  it("uses the shared learner search and fresh permissions on every execution", async () => {
    const args = { searchQuery: "safety", language: "en" };
    await service.executeNativeReadTool(
      userId,
      tenantId,
      "https://tenant.example",
      "global_search",
      args,
    );
    expect(search).toHaveBeenCalledWith(
      "safety",
      "en",
      expect.objectContaining({
        userId,
        tenantId,
        permissions: [PERMISSIONS.COURSE_READ],
      }),
      undefined,
      { contentOnly: true, learnerOnly: true, includeLearnerLessons: true },
    );
    permissions = [];
    await expect(
      service.executeNativeReadTool(
        userId,
        tenantId,
        "https://tenant.example",
        "global_search",
        args,
      ),
    ).rejects.toThrow("assistant.errors.unavailable");
    expect(search).toHaveBeenCalledTimes(1);
  });
  it("starts read progress only after the runner's fresh permission check", async () => {
    const onAuthorized = jest.fn(async () => undefined);
    const getUserAccess = Reflect.get(service, "permissionsService").getUserAccess as jest.Mock;
    getUserAccess
      .mockResolvedValueOnce({ permissions, roleSlugs: [] })
      .mockResolvedValueOnce({ permissions: [], roleSlugs: [] });
    const result = await service.executeNativeReadTool(
      userId,
      tenantId,
      "https://tenant.example",
      "global_search",
      { searchQuery: "safety", language: "en" },
      onAuthorized,
    );
    expect(result.isError).toBe(true);
    expect(onAuthorized).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it("signals authorized progress before executing the actual shared read", async () => {
    const onAuthorized = jest.fn(async () => undefined);
    search.mockImplementationOnce(async () => {
      expect(onAuthorized).toHaveBeenCalledTimes(1);
      return {
        allCourses: [],
        myCourses: [],
        availableCourses: [],
        news: [],
        articles: [],
        qa: [],
        lessons: [],
        learningPaths: [],
        users: [],
        groups: [],
        categories: [],
        searchMode: "keyword",
        semanticStatus: "disabled",
      };
    });
    await service.executeNativeReadTool(
      userId,
      tenantId,
      "https://tenant.example",
      "global_search",
      { searchQuery: "safety", language: "en" },
      onAuthorized,
    );
  });
  it("returns verified links for manageable courses from the actual native callback", async () => {
    permissions = Object.values(PERMISSIONS);
    const id = "96b1c16a-46e8-45d6-8c64-f50f9a08eb7a";
    Object.assign(service, {
      courseService: {
        getAllCourses: jest.fn().mockResolvedValue({
          data: [{ id, title: "Course fixture", status: "published", courseChapterCount: 2 }],
          pagination: { page: 1, perPage: 10, totalItems: 1 },
        }),
      },
    });
    const result = await service.executeNativeReadTool(
      userId,
      tenantId,
      "https://tenant.example",
      "list_courses",
      { language: "en", page: 1, pageSize: 10 },
    );
    const url = `https://tenant.example/admin/beta-courses/${id}`;
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual(
      expect.objectContaining({ courses: [expect.objectContaining({ id, url })] }),
    );
    const sources = collectAssistantSources(result.structuredContent, "https://tenant.example");
    expect(sources).toEqual([{ title: "Course fixture", url, entityType: "course" }]);
    expect(groundAssistantText(`[Course fixture](${url})`, sources)).toBe(
      `[Course fixture](${url})`,
    );
  });
  it("links authorized people through the actual native callback and rechecks user management access", async () => {
    permissions = [PERMISSIONS.USER_MANAGE];
    const id = "96b1c16a-46e8-45d6-8c64-f50f9a08eb7a";
    const getUsers = jest.fn().mockResolvedValue({
      data: [{ id, firstName: "Ada", lastName: "Nowak", email: "private@example.com" }],
      pagination: { page: 1, perPage: 10, totalItems: 1 },
    });
    Object.assign(service, { userService: { getUsers } });
    const result = await service.executeNativeReadTool(
      userId,
      tenantId,
      "https://tenant.example",
      "list_users",
      { page: 1, pageSize: 10 },
    );
    expect(result.isError).not.toBe(true);
    expect(collectAssistantSources(result.structuredContent, "https://tenant.example")).toEqual([
      { title: "Ada Nowak", url: `https://tenant.example/admin/users/${id}`, entityType: "user" },
    ]);
    permissions = [];
    await expect(
      service.executeNativeReadTool(userId, tenantId, "https://tenant.example", "list_users", {}),
    ).rejects.toThrow("assistant.errors.unavailable");
    expect(getUsers).toHaveBeenCalledTimes(1);
  });

  it("preserves OAuth authoring capability booleans and response shape", async () => {
    permissions = Object.values(PERMISSIONS);
    setModules(true);
    Object.assign(service, {
      activityLogsService: { recordActivity: jest.fn().mockResolvedValue(undefined) },
    });
    const callbacks = new Map<
      string,
      (
        input: unknown,
      ) => Promise<{ structuredContent?: Record<string, unknown>; isError?: boolean }>
    >();
    const collector = {
      registerTool: (
        name: string,
        _config: unknown,
        callback: (
          input: unknown,
        ) => Promise<{ structuredContent?: Record<string, unknown>; isError?: boolean }>,
      ) => {
        callbacks.set(name, callback);
        return { disable: () => undefined };
      },
    };
    const actor = {
      email: "fixture@example.com",
      grant: {
        userId,
        tenantId,
        clientId: "fixture-oauth",
        resource: "https://tenant.example/api/mcp",
        scopes: [MCP_SCOPES.AUTHORING],
        expiresAt: Date.now() + 60000,
      },
    };
    Reflect.apply(Reflect.get(service, "createServer"), service, [
      actor,
      permissions,
      featureSettings,
      collector,
    ]);
    const result = await (
      Reflect.get(service, "callContext") as AsyncLocalStorage<McpCallContext>
    ).run({ tool: "get_my_capabilities", requestId: "fixture-request", arguments: {} }, () =>
      callbacks.get("get_my_capabilities")!({}),
    );
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual(
      expect.objectContaining({ articles: true, news: true, qa: true, developmentPaths: true }),
    );
    expect(result.structuredContent).not.toHaveProperty("features");
  });

  it("preserves the existing OAuth management course-list output", async () => {
    permissions = Object.values(PERMISSIONS);
    const id = "96b1c16a-46e8-45d6-8c64-f50f9a08eb7a";
    Object.assign(service, {
      courseService: {
        getAllCourses: jest.fn().mockResolvedValue({
          data: [{ id, title: "Course fixture", status: "published", courseChapterCount: 2 }],
          pagination: { page: 1, perPage: 10, totalItems: 1 },
        }),
      },
      activityLogsService: { recordActivity: jest.fn().mockResolvedValue(undefined) },
    });
    const callbacks = new Map<
      string,
      (
        input: unknown,
      ) => Promise<{ structuredContent?: Record<string, unknown>; isError?: boolean }>
    >();
    const collector = {
      registerTool: (
        name: string,
        _config: unknown,
        callback: (
          input: unknown,
        ) => Promise<{ structuredContent?: Record<string, unknown>; isError?: boolean }>,
      ) => {
        callbacks.set(name, callback);
        return { disable: () => undefined };
      },
    };
    const actor = {
      email: "fixture@example.com",
      grant: {
        userId,
        tenantId,
        clientId: "fixture-oauth",
        resource: "https://tenant.example/api/mcp",
        scopes: [MCP_SCOPES.ACCOUNT_ACCESS],
        expiresAt: Date.now() + 60000,
      },
    };
    Reflect.apply(Reflect.get(service, "createServer"), service, [
      actor,
      permissions,
      {},
      collector,
    ]);
    const args = { language: "en", page: 1, pageSize: 10 };
    const result = await (
      Reflect.get(service, "callContext") as AsyncLocalStorage<McpCallContext>
    ).run({ tool: "list_courses", requestId: "fixture-request", arguments: args }, () =>
      callbacks.get("list_courses")!(args),
    );
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent?.courses).toEqual([
      { id, title: "Course fixture", status: "published", chapterCount: 2 },
    ]);
  });
});
