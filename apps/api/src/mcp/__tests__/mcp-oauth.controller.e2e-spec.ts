import { createHash, randomBytes, randomUUID } from "node:crypto";

import { MCP_REQUESTABLE_SCOPES, MCP_SCOPES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";

import { tenants } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";

import type { INestApplication } from "@nestjs/common";
import type { Test } from "supertest";

/** Real OAuth HTTP exchange against the guarded disposable MCP test stack. */
describe("MCP OAuth HTTP authorization (e2e)", () => {
  let app: INestApplication;
  let host: string;
  let cookie: string[];
  let clientId: string;
  const redirectUri = "http://127.0.0.1:32123/callback";
  const managementScopes = [MCP_SCOPES.ACCOUNT_ACCESS];
  const managementScope = managementScopes.join(" ");

  function http(path: string, method: "get" | "post" = "get"): Test {
    return request(app.getHttpServer())
      [method](path)
      .set("Host", host)
      .set("Referer", `http://${host}/`);
  }

  async function consent(scope: string | null = managementScope) {
    const verifier = randomBytes(32).toString("base64url");
    const response = await http("/api/oauth/authorize")
      .set("Cookie", cookie)
      .query({
        ...(scope === null ? {} : { scope }),
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        resource: `http://${host}/api/mcp`,
        state: "mcp-http-test",
        code_challenge_method: "S256",
        code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      })
      .expect(303);
    const nonce = new URL(response.headers.location, `http://${host}`).searchParams.get("consent");
    expect(typeof nonce).toBe("string");
    return { nonce: nonce!, verifier };
  }

  async function authorizationCode(scope: string | null = managementScope) {
    const pending = await consent(scope);
    const approved = await http("/api/oauth/authorize", "post")
      .set("Cookie", cookie)
      .type("form")
      .send({ consent: pending.nonce, decision: "approve" })
      .expect(303);
    const destination = new URL(approved.headers.location);
    expect(destination.origin + destination.pathname).toBe(redirectUri);
    expect(destination.searchParams.get("state")).toBe("mcp-http-test");
    const code = destination.searchParams.get("code");
    expect(typeof code).toBe("string");
    return { ...pending, code: code! };
  }

  function exchange(code: string, verifier: string) {
    return http("/api/oauth/token", "post")
      .type("form")
      .send({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        client_id: clientId,
        redirect_uri: redirectUri,
        resource: `http://${host}/api/mcp`,
      });
  }

  beforeAll(async () => {
    const setup = await createE2ETest({ useDbProxy: true });
    app = setup.app;
    app.useLogger(["error"]);
    await app.listen(0, "127.0.0.1");
    host = `mcp-oauth-${randomUUID()}.local`;
    await setup.dbAdmin
      .update(tenants)
      .set({ host: `http://${host}` })
      .where(eq(tenants.id, setup.defaultTenantId));
    const user = await setup.runAsTenant(setup.defaultTenantId, async () => {
      await createSettingsFactory(setup.db).create();
      return createUserFactory(setup.db)
        .withCredentials({ password: "Mcp-Test-Password123!" })
        .withAdminSettings(setup.db)
        .create({ tenantId: setup.defaultTenantId, roleSlug: SYSTEM_ROLE_SLUGS.ADMIN });
    });
    const login = await http("/api/auth/login", "post")
      .send({ email: user.email, password: "Mcp-Test-Password123!" })
      .expect(201);
    const cookies = login.headers["set-cookie"];
    cookie = Array.isArray(cookies) ? cookies : [cookies];
    const registered = await http("/api/oauth/register", "post")
      .send({
        client_name: "MCP HTTP regression",
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      })
      .expect(201);
    clientId = registered.body.client_id;
    expect(typeof clientId).toBe("string");
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it("requires web login and exposes consent details only to the signed-in account", async () => {
    const pending = await consent();
    await http(`/api/oauth/consent/${pending.nonce}`).expect(401);
    const details = await http(`/api/oauth/consent/${pending.nonce}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(details.body.data.clientId).toBe(clientId);
    expect(details.body.data.clientName).toBe("MCP HTTP regression");
    expect(details.body.data.scopes).toEqual(managementScopes);
    expect(details.body.data).not.toHaveProperty("scope");
    const denied = await http("/api/oauth/authorize", "post")
      .set("Cookie", cookie)
      .type("form")
      .send({ consent: pending.nonce, decision: "deny" })
      .expect(303);
    expect(new URL(denied.headers.location).searchParams.get("error")).toBe("access_denied");
    await http(`/api/oauth/consent/${pending.nonce}`).set("Cookie", cookie).expect(404);
  });

  it("rejects an invalid PKCE verifier and mismatched resource", async () => {
    const auth = await authorizationCode();
    const invalid = await exchange(auth.code, randomBytes(32).toString("base64url")).expect(400);
    expect(invalid.body.error).toBe("invalid_grant");
    const badResource = await http("/api/oauth/token", "post")
      .type("form")
      .send({
        grant_type: "authorization_code",
        code: auth.code,
        code_verifier: auth.verifier,
        client_id: clientId,
        redirect_uri: redirectUri,
        resource: "http://another-tenant.local/api/mcp",
      })
      .expect(400);
    expect(badResource.body.error).toBe("invalid_target");
  });

  it("defaults a new connection without a scope parameter to account access", async () => {
    const auth = await authorizationCode(null);
    const issued = await exchange(auth.code, auth.verifier).expect(200);
    expect(issued.body.scope).toBe(MCP_SCOPES.ACCOUNT_ACCESS);
  });

  it("accepts clients requesting every advertised scope as account access", async () => {
    const auth = await authorizationCode(MCP_REQUESTABLE_SCOPES.join(" "));
    const issued = await exchange(auth.code, auth.verifier).expect(200);
    expect(issued.body.scope).toBe(MCP_SCOPES.ACCOUNT_ACCESS);
  });

  it("exchanges a one-use code, calls MCP, refreshes access and revokes the resulting token", async () => {
    const auth = await authorizationCode();
    const issued = await exchange(auth.code, auth.verifier).expect(200);
    const access = issued.body.access_token as string;
    const refresh = issued.body.refresh_token as string;
    expect(typeof access).toBe("string");
    expect(typeof refresh).toBe("string");
    expect(issued.body.scope.split(" ")).toEqual(managementScopes);
    await exchange(auth.code, auth.verifier).expect(400);
    const initialized = await http("/api/mcp", "post")
      .set("Authorization", `Bearer ${access}`)
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "oauth-e2e", version: "1" },
        },
      })
      .expect(200);
    expect(initialized.text).toContain("mentingo");
    const renewed = await http("/api/oauth/token", "post")
      .type("form")
      .send({
        grant_type: "refresh_token",
        refresh_token: refresh,
        client_id: clientId,
        resource: `http://${host}/api/mcp`,
      })
      .expect(200);
    const renewedAccess = renewed.body.access_token as string;
    expect(typeof renewedAccess).toBe("string");
    expect(renewed.body.scope.split(" ")).toEqual(managementScopes);
    await http("/api/oauth/revoke", "post")
      .type("form")
      .send({ client_id: clientId, token: renewedAccess })
      .expect(200);
    await http("/api/mcp", "post")
      .set("Authorization", `Bearer ${renewedAccess}`)
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 2, method: "tools/list" })
      .expect(401);
  });

  it.each([MCP_SCOPES.SEARCH_READ, MCP_SCOPES.STUDENT_READ])(
    "keeps a real %s OAuth grant restricted through consent, exchange and refresh",
    async (scope) => {
      const auth = await authorizationCode(scope);
      const issued = await exchange(auth.code, auth.verifier).expect(200);
      expect(issued.body.scope).toBe(scope);
      const refresh = issued.body.refresh_token as string;
      const escalation = await http("/api/oauth/token", "post")
        .type("form")
        .send({
          grant_type: "refresh_token",
          refresh_token: refresh,
          client_id: clientId,
          resource: `http://${host}/api/mcp`,
          scope: MCP_SCOPES.COURSES_WRITE,
        })
        .expect(400);
      expect(escalation.body.error).toBe("invalid_scope");
      const renewed = await http("/api/oauth/token", "post")
        .type("form")
        .send({
          grant_type: "refresh_token",
          refresh_token: refresh,
          client_id: clientId,
          resource: `http://${host}/api/mcp`,
        })
        .expect(200);
      expect(renewed.body.scope).toBe(scope);
      const listed = await http("/api/mcp", "post")
        .set("Authorization", `Bearer ${renewed.body.access_token}`)
        .set("Accept", "application/json, text/event-stream")
        .send({ jsonrpc: "2.0", id: 3, method: "tools/list" })
        .expect(200);
      const body = listed.body?.jsonrpc
        ? listed.body
        : JSON.parse(
            listed.text
              .split(/\r?\n/)
              .find((line: string) => line.startsWith("data:"))!
              .slice(5)
              .trim(),
          );
      const tools = body.result.tools.map((tool: { name: string }) => tool.name);
      if (scope === MCP_SCOPES.SEARCH_READ) expect(tools).toEqual(["global_search"]);
      else {
        expect(tools).toEqual(expect.arrayContaining(["global_search", "get_course"]));
        expect(tools).not.toContain("create_course");
      }
    },
  );
});
