import { randomUUID } from "node:crypto";

import { PERMISSIONS, SYSTEM_ROLE_SLUGS, SYSTEM_RULE_SET_SLUGS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { and, eq } from "drizzle-orm";

import {
  automations,
  automationRuns,
  permissionRuleSets,
  permissionRuleSetPermissions,
} from "src/storage/schema";

import { cookieFor } from "../../../test/helpers/test-helpers";
import { automationSchema } from "../schema/automation.schema";

import {
  createWelcomeAutomationDefinition,
  setupAutomationTestContext,
} from "./automation-test.helpers";

import type { AutomationTestContext } from "./automation-test.helpers";

const idRoutes = [
  { method: "get", suffix: "" },
  { method: "patch", suffix: "", body: { name: "Changed" } },
  { method: "delete", suffix: "" },
  ...["duplicate", "apply", "enable", "disable", "archive"].map((operation) => ({
    method: "post" as const,
    suffix: `/${operation}`,
  })),
] as const;

const routes = [
  ...idRoutes.map((route) => ({ ...route, path: `/:id${route.suffix}` })),
  { method: "get", path: "" },
  { method: "post", path: "", body: createWelcomeAutomationDefinition() },
  ...["events", "templates", "workflow-templates", "recipient-options?type=user"].map((path) => ({
    method: "get" as const,
    path: `/${path}`,
  })),
  {
    method: "post",
    path: "/simulate",
    body: { workflow: createWelcomeAutomationDefinition().workflow },
  },
  { method: "get", path: "/automation-runs" },
  { method: "get", path: "/automation-runs/:id" },
] as const;

describe("Automation HTTP contracts (e2e)", () => {
  let t: AutomationTestContext;
  beforeAll(async () => {
    t = await setupAutomationTestContext();
  });
  beforeEach(async () => {
    await t.resetAutomationTestState();
  });
  afterAll(async () => {
    await t?.closeAutomationTestContext();
    jest.restoreAllMocks();
  });

  describe.each(routes.map((route) => ({ ...route, methodLabel: route.method.toUpperCase() })))(
    "$methodLabel $path authorization",
    (route) => {
      it.each(["anonymous", "student"])("rejects %s without modifying data", async (actor) => {
        const automation = await t.createAutomation();
        const before = await t.runAsTenant(t.defaultTenantId, () =>
          t.db.select().from(automations),
        );
        const req = t.requestAutomationApi(
          route.method,
          route.path.replace(":id", automation.id),
          actor === "anonymous" ? "" : t.studentCookie,
        );
        if ("body" in route) req.send(route.body);
        await req.expect(actor === "anonymous" ? 401 : 403);
        expect(
          await t.runAsTenant(t.defaultTenantId, () => t.db.select().from(automations)),
        ).toEqual(before);
        expect(
          await t.runAsTenant(t.defaultTenantId, () => t.db.select().from(automationRuns)),
        ).toEqual([]);
        expect(t.adapter.getAllEmails()).toEqual([]);
      });
    },
  );

  describe.each(idRoutes.map((route) => ({ ...route, methodLabel: route.method.toUpperCase() })))(
    "$methodLabel /:id$suffix",
    (route) => {
      it.each(["malformed", "missing", "deleted", "foreign"])(
        "rejects %s identifiers",
        async (kind) => {
          const automation = await t.createAutomation();
          let id = automation.id;
          if (kind === "malformed") id = "bad-id";
          if (kind === "missing") id = randomUUID();
          if (kind === "deleted") await t.requestAutomationApi("delete", `/${id}`).expect(200);
          const req = t.requestAutomationApi(
            route.method,
            `/${id}${route.suffix}`,
            kind === "foreign" ? t.otherCookie : t.adminCookie,
            kind === "foreign" ? t.otherTenant.host : undefined,
          );
          if ("body" in route) req.send(route.body);
          await req.expect(kind === "malformed" ? 400 : 404);
          if (kind !== "deleted") expect(await t.getAutomation(automation.id)).toEqual(automation);
        },
      );
    },
  );

  it.each([
    "?page=0",
    "?perPage=101",
    "?status=invalid",
    "?language=invalid",
    `?search=${"x".repeat(201)}`,
    "/recipient-options?type=everyone",
    "/recipient-options?type=user&id=bad",
  ])("rejects invalid query %s", async (query) => {
    await t.requestAutomationApi("get", query).expect(400);
  });

  it.each([
    { name: "" },
    { name: "x".repeat(201) },
    { description: "x".repeat(5001) },
    { workflow: { rootStepId: null, steps: [{ type: "wait" }] } },
    { workflow: { rootStepId: null, steps: [], unexpected: true } },
  ])("rejects malformed creation payload %#", async (patch) => {
    await t
      .requestAutomationApi("post")
      .send({ ...createWelcomeAutomationDefinition(), ...patch })
      .expect(400);
  });

  it("paginates and filters by draft name/status without leaking the other tenant", async () => {
    const first = await t.createAutomation({
      ...createWelcomeAutomationDefinition(),
      name: "Needle Alpha",
    });
    const second = await t.createEnabledAutomation({
      ...createWelcomeAutomationDefinition(),
      name: "Needle Beta",
    });
    const page = (
      await t.requestAutomationApi("get", "?search=Needle&perPage=1&page=1").expect(200)
    ).body;
    expect(page.data).toHaveLength(1);
    expect(Value.Check(automationSchema, page.data[0])).toBe(true);
    const next = (
      await t.requestAutomationApi("get", "?search=Needle&perPage=1&page=2").expect(200)
    ).body;
    expect(new Set([page.data[0].id, next.data[0].id])).toEqual(new Set([first.id, second.id]));
    expect(
      (
        await t.requestAutomationApi("get", "?search=Needle&status=enabled").expect(200)
      ).body.data.map((item: { id: string }) => item.id),
    ).toEqual([second.id]);
    expect(
      (
        await t
          .requestAutomationApi("get", "?search=Needle", t.otherCookie, t.otherTenant.host)
          .expect(200)
      ).body.data,
    ).toEqual([]);
  });

  it("scopes recipient searches and ID lookup to the current organization", async () => {
    const own = (
      await t
        .requestAutomationApi("get", `/recipient-options?type=user&id=${t.student.id}`)
        .expect(200)
    ).body.data;
    expect(own).toEqual([expect.objectContaining({ id: t.student.id })]);
    expect(
      (
        await t
          .requestAutomationApi("get", `/recipient-options?type=user&id=${t.otherAdmin.id}`)
          .expect(200)
      ).body.data,
    ).toEqual([]);
    expect(
      (
        await t
          .requestAutomationApi(
            "get",
            `/recipient-options?type=user&search=${encodeURIComponent(t.student.email)}`,
          )
          .expect(200)
      ).body.data,
    ).toEqual(own);
  });
  it.each([PERMISSIONS.AUTOMATION_MANAGE, PERMISSIONS.AUTOMATION_LOG_READ])(
    "honors the independent %s permission",
    async (permission) => {
      const ruleSet = await t.runAsTenant(t.defaultTenantId, async () => {
        const [role] = await t.db
          .select()
          .from(permissionRuleSets)
          .where(eq(permissionRuleSets.slug, SYSTEM_RULE_SET_SLUGS[SYSTEM_ROLE_SLUGS.STUDENT]));
        await t.db
          .insert(permissionRuleSetPermissions)
          .values({ ruleSetId: role.id, tenantId: t.defaultTenantId, permission });
        return role;
      });
      try {
        const cookie = await cookieFor(t.student, t.app);
        await t
          .requestAutomationApi("get", "", cookie)
          .expect(permission === PERMISSIONS.AUTOMATION_MANAGE ? 200 : 403);
        await t
          .requestAutomationApi("get", "/automation-runs", cookie)
          .expect(permission === PERMISSIONS.AUTOMATION_LOG_READ ? 200 : 403);
        await t
          .requestAutomationApi("post", "", cookie)
          .send(createWelcomeAutomationDefinition())
          .expect(permission === PERMISSIONS.AUTOMATION_MANAGE ? 201 : 403);
      } finally {
        await t.runAsTenant(t.defaultTenantId, () =>
          t.db
            .delete(permissionRuleSetPermissions)
            .where(
              and(
                eq(permissionRuleSetPermissions.ruleSetId, ruleSet.id),
                eq(permissionRuleSetPermissions.permission, permission),
              ),
            ),
        );
      }
    },
  );
});
