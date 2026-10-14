import { AsyncLocalStorage } from "node:async_hooks";

import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { FEATURES, FEATURE_SETTINGS_KEYS, PERMISSIONS } from "@repo/shared";
import express from "express";
import request from "supertest";

import { McpHttpService } from "../mcp-http.service";
import { MCP_GLOBAL_SEARCH_PERMISSIONS } from "../mcp-search-tools";
import { MCP_SCOPES } from "../mcp-tool-scope";

import type { McpToolRunner } from "../mcp-tool-runner.types";
import type { McpCallContext, McpToolActor } from "../mcp.types";
import type { McpServer } from "@modelcontextprotocol/server";

describe("MCP search scope runtime enforcement", () => {
  const actor: McpToolActor = {
    email: "search@example.test",
    grant: {
      userId: "00000000-0000-4000-8000-000000000001",
      tenantId: "00000000-0000-4000-8000-000000000002",
      clientId: "search-runtime",
      resource: "https://tenant.example.test/api/mcp",
      scopes: [MCP_SCOPES.SEARCH],
      expiresAt: Date.now() + 3600_000,
    },
  };

  const enabledSettings = {
    [FEATURE_SETTINGS_KEYS[FEATURES.ARTICLES]]: true,
    [FEATURE_SETTINGS_KEYS[FEATURES.NEWS]]: true,
    [FEATURE_SETTINGS_KEYS[FEATURES.QA]]: true,
    learningPathsEnabled: true,
  };

  function runtime() {
    const callContext = new AsyncLocalStorage<McpCallContext>();
    const getUserAccess = jest.fn().mockResolvedValue({
      permissions: Object.values(PERMISSIONS),
      roleSlugs: ["admin"],
    });
    const service = Object.assign(Object.create(McpHttpService.prototype), {
      callContext,
      permissionsService: { getUserAccess },
      settingsService: {
        getGlobalSettings: jest
          .fn()
          .mockResolvedValue(enabledSettings),
      },
      auditCall: jest.fn().mockResolvedValue(undefined),
      executeIdempotent: jest.fn((_actor, _context, operation) => operation()),
    }) as McpHttpService;
    return { service, callContext, getUserAccess };
  }

  async function catalog(scopes: string[], permissions = Object.values(PERMISSIONS)) {
    const { service } = runtime();
    const createServer = () =>
      Reflect.apply(Reflect.get(service, "createServer"), service, [
        { ...actor, grant: { ...actor.grant, scopes } },
        permissions,
        enabledSettings,
      ]) as McpServer;
    const app = express();
    app.use(express.json());
    const handler = toNodeHandler(createMcpHandler(createServer));
    app.all("/mcp", (req, res) => handler(req, res, req.body));
    const rpc = async (method: string, params: Record<string, unknown> = {}) => {
      const response = await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .set("MCP-Protocol-Version", "2025-11-25")
        .send({ jsonrpc: "2.0", id: 1, method, params })
        .expect(200);
      if (response.body?.jsonrpc) return response.body;
      return JSON.parse(
        response.text
          .split(/\r?\n/)
          .find((line: string) => line.startsWith("data:"))!
          .slice(5)
          .trim(),
      );
    };
    return { rpc };
  }

  it("exposes only global_search through the real SDK even for an administrator", async () => {
    const { rpc } = await catalog([MCP_SCOPES.SEARCH]);
    expect(
      (await rpc("tools/list")).result.tools.map((tool: { name: string }) => tool.name),
    ).toEqual(["global_search"]);
    for (const name of ["create_course", "list_users", "get_lesson"]) {
      const result = await rpc("tools/call", { name, arguments: {} });
      expect(Boolean(result.error || result.result?.isError)).toBe(true);
    }
  });

  it("student scope exposes only reader equivalents even for an administrator", async () => {
    const { rpc } = await catalog([MCP_SCOPES.STUDENT_READ]);
    const names = (await rpc("tools/list")).result.tools.map((tool: { name: string }) => tool.name);
    expect(names.sort()).toEqual(
      [
        "global_search",
        "list_student_courses",
        "get_student_course",
        "list_student_articles",
        "get_student_article",
        "list_student_news",
        "get_student_news",
        "list_student_qa_entries",
        "get_student_qa_entry",
      ].sort(),
    );
    expect(names).not.toEqual(expect.arrayContaining(["get_course", "get_lesson", "list_users"]));
  });
  it("caps the current sender's account permissions on each student tool execution", async () => {
    const { service, callContext } = runtime();
    const operation = jest.fn().mockResolvedValue({ articles: [] });
    await callContext.run({ tool: "global_search", requestId: "student", arguments: {} }, () =>
      Reflect.apply(Reflect.get(service, "run"), service, [
        { ...actor, grant: { ...actor.grant, scopes: [MCP_SCOPES.STUDENT_READ] } },
        [PERMISSIONS.ARTICLE_READ_PUBLIC],
        operation,
      ]),
    );
    const user = operation.mock.calls[0][0];
    expect(user.userId).toBe(actor.grant.userId);
    expect(user.permissions).not.toContain(PERMISSIONS.ARTICLE_MANAGE);
    expect(user.permissions).not.toContain(PERMISSIONS.COURSE_UPDATE);
  });

  it("preserves authoring discovery and intersects scope with content permissions", async () => {
    const authoring = await catalog([MCP_SCOPES.AUTHORING]);
    expect(
      (await authoring.rpc("tools/list")).result.tools.map((tool: { name: string }) => tool.name),
    ).toEqual(
      expect.arrayContaining(["global_search", "create_course", "list_users", "get_lesson"]),
    );
    for (const permissions of [[], [PERMISSIONS.USER_MANAGE]]) {
      const noContentAccess = await catalog([MCP_SCOPES.SEARCH], permissions);
      expect((await noContentAccess.rpc("tools/list")).result.tools).toEqual([]);
    }
  });

  it.each(["create_course", "list_users", "get_lesson"])(
    "rejects direct execution of %s before permission loading or domain side effects",
    async (tool) => {
      const { service, callContext, getUserAccess } = runtime();
      const operation = jest.fn().mockResolvedValue({ id: "must-not-run" });
      const result = await callContext.run(
        { tool, requestId: "request", arguments: {} },
        () =>
          Reflect.apply(Reflect.get(service, "run"), service, [
            actor,
            [],
            operation,
          ]) as ReturnType<McpToolRunner>,
      );
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).code).toBe("PERMISSION_DENIED");
      expect(operation).not.toHaveBeenCalled();
      expect(getUserAccess).not.toHaveBeenCalled();
    },
  );

  it("rechecks permissions when executing global_search even with a valid search scope", async () => {
    const { service, callContext, getUserAccess } = runtime();
    getUserAccess.mockResolvedValue({ permissions: [], roleSlugs: [] });
    const operation = jest.fn().mockResolvedValue({ articles: [] });
    const result = await callContext.run(
      { tool: "global_search", requestId: "request", arguments: {} },
      () =>
        Reflect.apply(Reflect.get(service, "run"), service, [
          actor,
          MCP_GLOBAL_SEARCH_PERMISSIONS,
          operation,
        ]) as ReturnType<McpToolRunner>,
    );
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).code).toBe("PERMISSION_DENIED");
    expect(operation).not.toHaveBeenCalled();
    expect(getUserAccess).toHaveBeenCalledWith(actor.grant.userId);
  });
});
