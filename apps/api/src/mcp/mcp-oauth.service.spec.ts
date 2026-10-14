import { createHash } from "node:crypto";

import { McpOAuthService } from "./mcp-oauth.service";
import { MCP_REQUESTABLE_SCOPES } from "./mcp-tool-scope";

import type { McpClient } from "./mcp-oauth.types";
import type { Request, Response } from "express";

const userId = "11111111-1111-4111-8111-111111111111";
const tenantA = "22222222-2222-4222-8222-222222222222";
const tenantB = "33333333-3333-4333-8333-333333333333";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildRedis() {
  const store = new Map<string, string>();
  return {
    store,
    get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve("OK");
    }),
    expire: jest.fn(() => Promise.resolve(1)),
    del: jest.fn((key: string) => {
      const existed = store.delete(key);
      return Promise.resolve(existed ? 1 : 0);
    }),
    sendCommand: jest.fn(([command, key]: string[]) => {
      if (command !== "GETDEL") return Promise.resolve(null);
      const value = store.get(key) ?? null;
      store.delete(key);
      return Promise.resolve(value);
    }),
  };
}

function buildService(
  redis: ReturnType<typeof buildRedis>,
  resourceTenantId: string,
  webUserPayload: { userId: string; tenantId: string } | null,
  email: string | null,
  tokenStore: jest.Mock = jest.fn(),
) {
  const config = { get: jest.fn(() => "jwt-secret") };
  const jwt = {
    verifyAsync: jest.fn(() =>
      webUserPayload ? Promise.resolve(webUserPayload) : Promise.reject(new Error("invalid")),
    ),
  };
  const mcpTokens = {
    resolveIdentity: jest.fn(() => Promise.resolve(email)),
    resolve: jest.fn(),
    store: tokenStore,
    revoke: jest.fn(),
  };
  const resources = {
    forTenant: jest.fn(() =>
      Promise.resolve({
        tenantId: resourceTenantId,
        origin: "https://tenant.example.com",
        url: "https://tenant.example.com/api/mcp",
      }),
    ),
    fromRequest: jest.fn(() =>
      Promise.resolve({
        tenantId: resourceTenantId,
        origin: "https://tenant.example.com",
        url: "https://tenant.example.com/api/mcp",
      }),
    ),
  };

  return new McpOAuthService(
    redis as never,
    config as never,
    jwt as never,
    mcpTokens as never,
    resources as never,
  );
}

function buildRes(): Response {
  const res = {
    setHeader: jest.fn(),
    redirect: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
    end: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

async function storeClient(
  redis: ReturnType<typeof buildRedis>,
  clientId: string,
  overrides: Partial<McpClient> = {},
) {
  const client: McpClient = {
    id: clientId,
    name: "Authoring assistant",
    tenantId: tenantA,
    redirectUris: ["https://client.example.com/callback"],
    grants: ["authorization_code", "refresh_token"],
    accessTokenLifetime: 3600,
    refreshTokenLifetime: 3600,
    ...overrides,
  };
  await redis.set(`mcp:oauth:client:${clientId}`, JSON.stringify(client));
}

describe("McpOAuthService tenant-scoped client lookup", () => {
  it("rejects an authorization request for a client registered under another tenant", async () => {
    const redis = buildRedis();
    await storeClient(redis, "client-1", { tenantId: tenantA });
    const service = buildService(
      redis,
      tenantB,
      { userId, tenantId: tenantB },
      "actor@example.com",
    );

    const req = {
      query: {
        client_id: "client-1",
        redirect_uri: "https://client.example.com/callback",
        resource: "https://tenant.example.com/api/mcp",
        response_type: "code",
        code_challenge_method: "S256",
        code_challenge: "A".repeat(43),
        state: "xyz",
        scope: "courses:read",
      },
      cookies: { access_token: "jwt-token" },
    } as unknown as Request;
    const res = buildRes();

    await service.authorizationPage(req, res);

    expect(res.redirect).toHaveBeenCalledWith(303, "/oauth/connect?error=invalid");
    expect([...redis.store.keys()].some((key) => key.startsWith("mcp:oauth:consent:"))).toBe(false);
  });

  it("accepts an authorization request for a client registered under the requesting tenant", async () => {
    const redis = buildRedis();
    await storeClient(redis, "client-2", { tenantId: tenantB });
    const service = buildService(
      redis,
      tenantB,
      { userId, tenantId: tenantB },
      "actor@example.com",
    );

    const req = {
      query: {
        client_id: "client-2",
        redirect_uri: "https://client.example.com/callback",
        resource: "https://tenant.example.com/api/mcp",
        response_type: "code",
        code_challenge_method: "S256",
        code_challenge: "A".repeat(43),
        state: "xyz",
        scope: "courses:read",
      },
      cookies: { access_token: "jwt-token" },
    } as unknown as Request;
    const res = buildRes();

    await service.authorizationPage(req, res);

    expect(res.redirect).toHaveBeenCalledWith(
      303,
      expect.stringMatching(/^\/oauth\/connect\?consent=/),
    );
  });
});

describe("McpOAuthService.consentDetails", () => {
  it("includes the client id and requested redirect uri alongside the client name", async () => {
    const redis = buildRedis();
    await storeClient(redis, "client-3", { tenantId: tenantB, name: "Authoring assistant" });
    const service = buildService(
      redis,
      tenantB,
      { userId, tenantId: tenantB },
      "actor@example.com",
    );

    const nonce = "n".repeat(43);
    await redis.set(
      `mcp:oauth:consent:${digest(nonce)}`,
      JSON.stringify({
        userId,
        query: {
          client_id: "client-3",
          scope: "courses:read",
          redirect_uri: "https://client.example.com/callback",
          resource: "https://tenant.example.com/api/mcp",
        },
      }),
    );

    const req = { cookies: { access_token: "jwt-token" } } as unknown as Request;
    const details = await service.consentDetails(req, nonce);

    expect(details).toEqual({
      clientName: "Authoring assistant",
      clientId: "client-3",
      redirectUri: "https://client.example.com/callback",
      accountEmail: "actor@example.com",
      scopes: ["courses:read"],
    });
  });
});

describe("McpOAuthService.authorize", () => {
  it("does not consume the consent nonce when the requester has no valid session", async () => {
    const redis = buildRedis();
    const service = buildService(redis, tenantB, null, null);

    const nonce = "n".repeat(43);
    const consentKey = `mcp:oauth:consent:${digest(nonce)}`;
    await redis.set(
      consentKey,
      JSON.stringify({
        userId,
        query: { client_id: "client-4", resource: "https://tenant.example.com/api/mcp" },
      }),
    );

    const req = {
      body: { consent: nonce, decision: "approve" },
      cookies: {},
    } as unknown as Request;
    const res = buildRes();

    await service.authorize(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(redis.store.has(consentKey)).toBe(true);
  });
});

const resourceUrl = "https://tenant.example.com/api/mcp";
const redirectUri = "https://client.example.com/callback";
const verifier = "v".repeat(43);
const challenge = createHash("sha256").update(verifier).digest("base64url");

function authorizationRequest(scope?: unknown): Request {
  return {
    query: {
      client_id: "scoped-client",
      redirect_uri: redirectUri,
      resource: resourceUrl,
      response_type: "code",
      code_challenge_method: "S256",
      code_challenge: challenge,
      state: "client-state",
      ...(scope === undefined ? {} : { scope }),
    },
    cookies: { access_token: "jwt-token" },
  } as unknown as Request;
}

function responseRedirect(res: Response): string {
  return (res.redirect as jest.Mock).mock.calls.at(-1)[1];
}

function responseBody(res: Response): Record<string, string> {
  return (res.json as jest.Mock).mock.calls.at(-1)[0];
}

function tokenRequest(body: Record<string, unknown>): Request {
  return {
    method: "POST",
    query: {},
    headers: { "content-type": "application/x-www-form-urlencoded", "content-length": "128" },
    body: { client_id: "scoped-client", resource: resourceUrl, ...body },
  } as unknown as Request;
}

async function approvedCode(service: McpOAuthService, scope = "search:read"): Promise<string> {
  const pageRes = buildRes();
  await service.authorizationPage(authorizationRequest(scope), pageRes);
  const nonce = new URL(responseRedirect(pageRes), "https://tenant.example.com").searchParams.get(
    "consent",
  );
  expect(nonce).toBeTruthy();
  const consent = await service.consentDetails(authorizationRequest(scope), nonce!);
  expect(consent.scopes).toEqual(scope.split(" "));
  const approvalRes = buildRes();
  await service.authorize(
    {
      body: { consent: nonce, decision: "approve" },
      cookies: { access_token: "jwt-token" },
    } as unknown as Request,
    approvalRes,
  );
  const callback = new URL(responseRedirect(approvalRes));
  expect(callback.searchParams.get("state")).toBe("client-state");
  expect(callback.searchParams.get("error")).toBeNull();
  return callback.searchParams.get("code")!;
}

describe("McpOAuthService explicit scopes", () => {
  it("advertises only requestable explicit scopes for the resource and authorization server", async () => {
    const service = buildService(
      buildRedis(),
      tenantA,
      { userId, tenantId: tenantA },
      "actor@example.com",
    );
    expect((await service.metadata({} as Request)).scopes_supported).toEqual(
      MCP_REQUESTABLE_SCOPES,
    );
    expect((await service.serverMetadata({} as Request)).scopes_supported).toEqual(
      MCP_REQUESTABLE_SCOPES,
    );
  });

  it.each([
    "student:read",
    "search:read",
    "courses:read articles:read",
    "courses:read courses:write",
  ])(
    "preserves %s through consent, PKCE exchange, and refresh without scope escalation",
    async (requestedScope) => {
      const redis = buildRedis();
      await storeClient(redis, "scoped-client");
      const tokenStore = jest.fn();
      const service = buildService(
        redis,
        tenantA,
        { userId, tenantId: tenantA },
        "actor@example.com",
        tokenStore,
      );
      const expectedScope = requestedScope;
      const code = await approvedCode(service, requestedScope);
      const exchangeRes = buildRes();
      await service.token(
        tokenRequest({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          code_verifier: verifier,
        }),
        exchangeRes,
      );
      const exchange = responseBody(exchangeRes);
      expect(exchangeRes.status).toHaveBeenCalledWith(200);
      expect(exchange).toEqual(expect.objectContaining({ scope: expectedScope }));
      expect(tokenStore).toHaveBeenLastCalledWith(
        exchange.access_token,
        expect.objectContaining({
          userId,
          tenantId: tenantA,
          resource: resourceUrl,
          scopes: expectedScope.split(" "),
        }),
      );
      const refreshKey = `mcp:oauth:refresh:${digest(exchange.refresh_token)}`;
      expect(JSON.parse(redis.store.get(refreshKey)!).scope).toEqual(expectedScope.split(" "));

      const escalationRes = buildRes();
      await service.token(
        tokenRequest({
          grant_type: "refresh_token",
          refresh_token: exchange.refresh_token,
          scope: "platform:write",
        }),
        escalationRes,
      );
      expect(responseBody(escalationRes)).toEqual({ error: "invalid_scope" });
      expect(redis.store.has(refreshKey)).toBe(true);
      expect(tokenStore).toHaveBeenCalledTimes(1);

      const refreshRes = buildRes();
      await service.token(
        tokenRequest({
          grant_type: "refresh_token",
          refresh_token: exchange.refresh_token,
        }),
        refreshRes,
      );
      const refreshed = responseBody(refreshRes);
      expect(refreshRes.status).toHaveBeenCalledWith(200);
      expect(refreshed.scope).toBe(expectedScope);
      expect(tokenStore).toHaveBeenLastCalledWith(
        refreshed.access_token,
        expect.objectContaining({
          scopes: expectedScope.split(" "),
        }),
      );
      expect(
        JSON.parse(redis.store.get(`mcp:oauth:refresh:${digest(refreshed.refresh_token)}`)!).scope,
      ).toEqual(expectedScope.split(" "));
    },
  );

  it.each([
    undefined,
    "authoring",
    "search",
    "unknown",
    "student:read courses:read",
    "courses:read courses:read",
    "",
    ["courses:read"],
  ])("rejects an invalid authorization scope %p before creating consent", async (scope) => {
    const redis = buildRedis();
    await storeClient(redis, "scoped-client");
    const service = buildService(
      redis,
      tenantA,
      { userId, tenantId: tenantA },
      "actor@example.com",
    );
    const res = buildRes();
    await service.authorizationPage(authorizationRequest(scope), res);
    expect(res.redirect).toHaveBeenCalledWith(303, "/oauth/connect?error=invalid");
    expect([...redis.store.keys()].some((key) => key.startsWith("mcp:oauth:consent:"))).toBe(false);
  });

  it("rejects token exchange scope changes without consuming the code", async () => {
    const redis = buildRedis();
    await storeClient(redis, "scoped-client");
    const tokenStore = jest.fn();
    const service = buildService(
      redis,
      tenantA,
      { userId, tenantId: tenantA },
      "actor@example.com",
      tokenStore,
    );
    const code = await approvedCode(service, "search:read");
    const res = buildRes();
    await service.token(
      tokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        scope: "courses:write",
      }),
      res,
    );
    expect(responseBody(res)).toEqual({ error: "invalid_scope" });
    expect(tokenStore).not.toHaveBeenCalled();
    expect(redis.store.has(`mcp:oauth:code:${digest(code)}`)).toBe(true);
  });
});

describe("McpOAuthService stored grant validation", () => {
  it.each([undefined, [], ["unknown"], ["search", "authoring"]])(
    "rejects an authorization code whose stored scope is invalid: %p",
    async (scope) => {
      const redis = buildRedis();
      await storeClient(redis, "scoped-client");
      const tokenStore = jest.fn();
      const service = buildService(
        redis,
        tenantA,
        { userId, tenantId: tenantA },
        "actor@example.com",
        tokenStore,
      );
      const code = await approvedCode(service, "search:read");
      const key = `mcp:oauth:code:${digest(code)}`;
      const stored = JSON.parse(redis.store.get(key)!);
      redis.store.set(key, JSON.stringify({ ...stored, scope }));
      const res = buildRes();
      await service.token(
        tokenRequest({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          code_verifier: verifier,
        }),
        res,
      );
      expect(responseBody(res)).toEqual({ error: "invalid_grant" });
      expect(tokenStore).not.toHaveBeenCalled();
    },
  );

  it("keeps PKCE enforcement for search authorization codes", async () => {
    const redis = buildRedis();
    await storeClient(redis, "scoped-client");
    const tokenStore = jest.fn();
    const service = buildService(
      redis,
      tenantA,
      { userId, tenantId: tenantA },
      "actor@example.com",
      tokenStore,
    );
    const code = await approvedCode(service, "search:read");
    const res = buildRes();
    await service.token(
      tokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: "wrong-verifier".repeat(4),
      }),
      res,
    );
    expect(responseBody(res).error).toBe("invalid_grant");
    expect(tokenStore).not.toHaveBeenCalled();
  });

  it("rejects a refresh token with a malformed stored scope", async () => {
    const redis = buildRedis();
    await storeClient(redis, "scoped-client");
    const tokenStore = jest.fn();
    const service = buildService(
      redis,
      tenantA,
      { userId, tenantId: tenantA },
      "actor@example.com",
      tokenStore,
    );
    const code = await approvedCode(service, "search:read");
    const exchangeRes = buildRes();
    await service.token(
      tokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
      exchangeRes,
    );
    const refreshToken = responseBody(exchangeRes).refresh_token;
    const key = `mcp:oauth:refresh:${digest(refreshToken)}`;
    redis.store.set(
      key,
      JSON.stringify({ ...JSON.parse(redis.store.get(key)!), scope: ["admin"] }),
    );
    const res = buildRes();
    await service.token(
      tokenRequest({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      res,
    );
    expect(responseBody(res)).toEqual({ error: "invalid_grant" });
    expect(tokenStore).toHaveBeenCalledTimes(1);
  });
});

describe("McpOAuthService existing grants", () => {
  it.each(["authoring", "search"])(
    "preserves legacy %s on refresh without accepting any new scope",
    async (legacyScope) => {
      const redis = buildRedis();
      await storeClient(redis, "scoped-client");
      const tokenStore = jest.fn();
      const service = buildService(
        redis,
        tenantA,
        { userId, tenantId: tenantA },
        "actor@example.com",
        tokenStore,
      );
      const refreshToken = "legacy-refresh-token";
      const key = `mcp:oauth:refresh:${digest(refreshToken)}`;
      redis.store.set(
        key,
        JSON.stringify({
          refreshToken,
          refreshTokenExpiresAt: new Date(Date.now() + 60000).toISOString(),
          client: JSON.parse(redis.store.get("mcp:oauth:client:scoped-client")!),
          user: { userId, tenantId: tenantA, resource: resourceUrl },
          scope: [legacyScope],
        }),
      );
      const changedRes = buildRes();
      await service.token(
        tokenRequest({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          scope: "student:read",
        }),
        changedRes,
      );
      expect(responseBody(changedRes)).toEqual({ error: "invalid_scope" });
      expect(redis.store.has(key)).toBe(true);
      const refreshedRes = buildRes();
      await service.token(
        tokenRequest({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          scope: legacyScope,
        }),
        refreshedRes,
      );
      expect(refreshedRes.status).toHaveBeenCalledWith(200);
      expect(responseBody(refreshedRes).scope).toBe(legacyScope);
      expect(tokenStore).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ scopes: [legacyScope] }),
      );
    },
  );

  it("accepts reordered scopes on refresh but rejects narrowing before rotation", async () => {
    const redis = buildRedis();
    await storeClient(redis, "scoped-client");
    const service = buildService(
      redis,
      tenantA,
      { userId, tenantId: tenantA },
      "actor@example.com",
    );
    const code = await approvedCode(service, "courses:read articles:read");
    const exchangeRes = buildRes();
    await service.token(
      tokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
      exchangeRes,
    );
    const refreshToken = responseBody(exchangeRes).refresh_token;
    const key = `mcp:oauth:refresh:${digest(refreshToken)}`;
    const narrowedRes = buildRes();
    await service.token(
      tokenRequest({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: "courses:read",
      }),
      narrowedRes,
    );
    expect(responseBody(narrowedRes)).toEqual({ error: "invalid_scope" });
    expect(redis.store.has(key)).toBe(true);
    const reorderedRes = buildRes();
    await service.token(
      tokenRequest({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: "articles:read courses:read",
      }),
      reorderedRes,
    );
    expect(reorderedRes.status).toHaveBeenCalledWith(200);
    expect(responseBody(reorderedRes).scope.split(" ").sort()).toEqual([
      "articles:read",
      "courses:read",
    ]);
  });
});
