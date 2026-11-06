import { AsyncLocalStorage } from "node:async_hooks";

import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ASSISTANT_SOURCE_TYPES, SUPPORTED_LANGUAGES } from "@repo/shared";

import {
  collectAssistantSources,
  hasAssistantReadableContent,
} from "src/assistant/assistant-links";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { McpHttpService } from "./mcp-http.service";
import { NATIVE_READ_TOOL_NAMES } from "./mcp-native-read.types";
import { registerMcpHelpdeskTools } from "./mcp-self-onboarding-tools";
import { MCP_HELPDESK_TOOL_NAMES } from "./mcp-self-onboarding.constants";
import { canListMcpTool } from "./mcp-tool-access";
import { canUseMcpToolWithScopes, isMcpScopeSet, MCP_SCOPES } from "./mcp-tool-scope";

import type { McpToolRunner } from "./mcp-tool-runner.types";
import type { McpCallContext, McpToolActor } from "./mcp.types";
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
  HelpdeskSearchResponse,
  HelpdeskTutorialResponse,
} from "src/self-onboarding/schemas/self-onboarding.schema";
import type { HelpdeskService } from "src/self-onboarding/self-onboarding.service";
import type { SettingsService } from "src/settings/settings.service";

const origin = "https://tenant.example";
const tutorial: HelpdeskTutorialResponse = {
  key: "course-authoring.edit",
  revisionId: "11111111-1111-4111-8111-111111111111",
  domain: "course-authoring" as HelpdeskTutorialResponse["domain"],
  title: "Edit the curriculum",
  description: "How to use the course editor.",
  language: "en",
  languageFallback: false,
  durationMs: 60000,
  videoUrl: "https://vz-public.b-cdn.net/11111111-1111-4111-8111-111111111111/playlist.m3u8",
  posterUrl: "https://vz-public.b-cdn.net/11111111-1111-4111-8111-111111111111/thumbnail.jpg",
  pageKeys: ["admin.course.curriculum"],
  chapters: [
    {
      id: "add-lesson",
      title: "Add a lesson",
      description: "Use Add lesson.",
      startMs: 1000,
      endMs: 60000,
    },
  ],
};
const response: HelpdeskSearchResponse = {
  mode: "hybrid" as HelpdeskSearchResponse["mode"],
  results: [
    {
      tutorial,
      chapterId: "add-lesson",
      excerpt: "Add a lesson to the curriculum",
      startMs: 1000,
      endMs: 60000,
      rankScore: 0.02,
    },
  ],
};
const input = {
  query: "add a lesson",
  language: SUPPORTED_LANGUAGES.EN,
  pageKey: "admin.course.curriculum",
  limit: 8,
};
const account = {
  userId: "actor",
  tenantId: "tenant",
  email: "actor@example.com",
  permissions: [],
  roleSlugs: [],
} as CurrentUserType;

function fixture() {
  const search = jest.fn().mockResolvedValue(response);
  const getTutorial = jest.fn().mockResolvedValue(tutorial);
  const helpdeskService = { search, getTutorial } as unknown as HelpdeskService;
  const findActiveAccount = jest.fn().mockResolvedValue({ email: account.email });
  const service = Object.assign(Object.create(McpHttpService.prototype), {
    callContext: new AsyncLocalStorage<McpCallContext>(),
    mcpActorRepository: { findActiveAccount },
    permissionsService: {
      getUserAccess: jest.fn().mockResolvedValue({ permissions: [], roleSlugs: [] }),
    },
    settingsService: { getGlobalSettings: jest.fn().mockResolvedValue({}) },
    tenantDbRunnerService: new TenantDbRunnerService({} as never),
    helpdeskService,
    auditCall: jest.fn().mockResolvedValue(undefined),
  }) as McpHttpService;
  return { service, helpdeskService, search, getTutorial, findActiveAccount };
}

describe("Authenticated public product guidance tools", () => {
  it("delegates only declared arguments to the common service and returns exact public media/timeline links", async () => {
    const f = fixture();
    const registerTool = jest.fn();
    const run = jest.fn(async (_permissions, operation) => ({
      structuredContent: await operation(account),
      content: [],
    }));
    registerMcpHelpdeskTools(
      { registerTool } as unknown as McpServer,
      run as McpToolRunner,
      f.helpdeskService,
      `${origin}/api/mcp`,
    );
    expect(registerTool.mock.calls.map(([name]) => name)).toEqual(
      Object.values(MCP_HELPDESK_TOOL_NAMES),
    );
    for (const [, config] of registerTool.mock.calls) {
      expect(config.annotations).toEqual({ readOnlyHint: true, destructiveHint: false });
      expect(config.description).toMatch(/product|Mentingo product/);
    }
    const searchResult = await registerTool.mock.calls[0][2](input);
    expect(f.search).toHaveBeenCalledWith(input);
    expect(run).toHaveBeenLastCalledWith([], expect.any(Function));
    expect(searchResult.structuredContent.results[0]).toEqual(
      expect.objectContaining({
        url: `${origin}/helpdesk/tutorials/course-authoring.edit?chapter=add-lesson`,
        startMs: 1000,
        endMs: 60000,
        entityType: ASSISTANT_SOURCE_TYPES.HELPDESK,
        guidanceKind: "product_guidance",
        tutorial: expect.objectContaining({ videoUrl: tutorial.videoUrl }),
      }),
    );
    const readResult = await registerTool.mock.calls[1][2]({
      key: tutorial.key,
      language: SUPPORTED_LANGUAGES.PL,
    });
    expect(f.getTutorial).toHaveBeenCalledWith(tutorial.key, { language: SUPPORTED_LANGUAGES.PL });
    expect(readResult.structuredContent.tutorial.chapters[0]).toEqual(
      expect.objectContaining({
        url: `${origin}/helpdesk/tutorials/course-authoring.edit?chapter=add-lesson`,
        startMs: 1000,
        endMs: 60000,
      }),
    );
    const sources = collectAssistantSources(
      searchResult.structuredContent,
      origin,
      MCP_HELPDESK_TOOL_NAMES.SEARCH,
    );
    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: `${origin}/helpdesk/tutorials/course-authoring.edit`,
          entityType: ASSISTANT_SOURCE_TYPES.HELPDESK,
        }),
        expect.objectContaining({
          url: `${origin}/helpdesk/tutorials/course-authoring.edit?chapter=add-lesson`,
          entityType: ASSISTANT_SOURCE_TYPES.HELPDESK,
        }),
      ]),
    );
    expect(
      hasAssistantReadableContent(MCP_HELPDESK_TOOL_NAMES.TUTORIAL, readResult.structuredContent),
    ).toBe(false);
    expect(JSON.stringify(f.search.mock.calls)).not.toContain(origin);
  });

  it("adds public guidance to valid scopes without expanding any tenant tool gate", () => {
    const settings = {} as Awaited<ReturnType<SettingsService["getGlobalSettings"]>>;
    for (const scope of Object.values(MCP_SCOPES)) {
      expect(isMcpScopeSet([scope])).toBe(true);
      for (const name of Object.values(MCP_HELPDESK_TOOL_NAMES)) {
        expect(canUseMcpToolWithScopes(name, [scope])).toBe(true);
        expect(canListMcpTool(name, [], settings)).toBe(true);
        expect(NATIVE_READ_TOOL_NAMES.has(name)).toBe(true);
      }
    }
    for (const invalid of [
      undefined,
      [],
      ["invented"],
      [MCP_SCOPES.STUDENT_READ, MCP_SCOPES.COURSES_READ],
    ])
      expect(canUseMcpToolWithScopes(MCP_HELPDESK_TOOL_NAMES.SEARCH, invalid)).toBe(false);
    expect(canUseMcpToolWithScopes("get_course", [MCP_SCOPES.SEARCH_READ])).toBe(false);
    expect(canUseMcpToolWithScopes("create_course", [MCP_SCOPES.STUDENT_READ])).toBe(false);
    expect(canListMcpTool("create_course", [], settings)).toBe(false);
  });

  it("exposes real native callbacks and progress without tenant permissions, while rechecking active identity", async () => {
    const f = fixture();
    const tools = await f.service.listNativeReadTools(account.userId, account.tenantId, origin);
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(Object.values(MCP_HELPDESK_TOOL_NAMES)),
    );
    const checkpoint = jest.fn().mockResolvedValue(undefined);
    const result = await f.service.executeNativeReadTool(
      account.userId,
      account.tenantId,
      origin,
      MCP_HELPDESK_TOOL_NAMES.SEARCH,
      input,
      checkpoint,
    );
    expect(result.isError).not.toBe(true);
    expect(f.search).toHaveBeenCalledWith(input);
    expect(checkpoint).toHaveBeenCalledTimes(1);
    const capabilities = await f.service.executeNativeReadTool(
      account.userId,
      account.tenantId,
      origin,
      "get_my_capabilities",
      {},
    );
    expect(capabilities.structuredContent).toEqual(
      expect.objectContaining({
        helpdesk: { canSearch: true, canRead: true, guidanceKind: "product_guidance" },
      }),
    );
    f.findActiveAccount.mockResolvedValue(undefined);
    await expect(
      f.service.executeNativeReadTool(
        account.userId,
        account.tenantId,
        origin,
        MCP_HELPDESK_TOOL_NAMES.SEARCH,
        input,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.search).toHaveBeenCalledTimes(1);
  });

  it("rejects forged external context and unsupported language before native service calls", async () => {
    const f = fixture();
    for (const invalid of [
      { ...input, appVersion: "99.0.0" },
      { ...input, features: ["admin"] },
      { ...input, language: "invented" },
      { ...input, pageKey: "https://tenant.example/course/private" },
    ]) {
      await expect(
        f.service.executeNativeReadTool(
          account.userId,
          account.tenantId,
          origin,
          MCP_HELPDESK_TOOL_NAMES.SEARCH,
          invalid,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(f.search).not.toHaveBeenCalled();
  });

  it("refuses an expired OAuth actor even when a previously registered callback is retained", async () => {
    const f = fixture();
    const actor: McpToolActor = {
      email: account.email,
      grant: {
        ...account,
        clientId: "helpdesk-fixture",
        resource: `${origin}/api/mcp`,
        scopes: [MCP_SCOPES.SEARCH_READ],
        expiresAt: Date.now() - 1,
      },
    };
    const registrations = new Map<
      string,
      { callback: (input: unknown) => Promise<CallToolResult>; enabled: boolean }
    >();
    const collector = {
      registerTool(
        name: string,
        _config: unknown,
        callback: (input: unknown) => Promise<CallToolResult>,
      ) {
        const registration = { callback, enabled: true };
        registrations.set(name, registration);
        return {
          disable() {
            registration.enabled = false;
          },
        };
      },
    } as unknown as McpServer;
    Reflect.apply(Reflect.get(f.service, "createServer"), f.service, [actor, [], {}, collector]);
    const registration = registrations.get(MCP_HELPDESK_TOOL_NAMES.SEARCH)!;
    expect(registration.enabled).toBe(false);
    const result = await (
      Reflect.get(f.service, "callContext") as AsyncLocalStorage<McpCallContext>
    ).run(
      { tool: MCP_HELPDESK_TOOL_NAMES.SEARCH, arguments: input, requestId: "expired-helpdesk" },
      () => registration.callback(input),
    );
    expect(result.isError).toBe(true);
    expect(f.search).not.toHaveBeenCalled();
  });
});
