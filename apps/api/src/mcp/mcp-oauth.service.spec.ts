import { createHash } from "node:crypto";

import { McpOAuthService } from "./mcp-oauth.service";

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
    store: jest.fn(),
    revoke: jest.fn(),
  };
  const resources = {
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
