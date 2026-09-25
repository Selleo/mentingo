import { createHash, randomBytes } from "node:crypto";

import { Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import OAuth2Server from "@node-oauth/oauth2-server";

import { REDIS_CLIENT, type RedisClient } from "src/redis";

import { McpResourceService } from "./mcp-resource.service";
import { McpTokenService } from "./mcp-token.service";

import type { McpConsentDetails } from "./mcp-oauth-consent.schema";
import type {
  McpClient,
  McpUser,
  StoredCode,
  StoredRefresh,
  ConsentRequest,
} from "./mcp-oauth.types";
import type { Request, Response } from "express";

const ACCESS_TTL = 3600;
const REFRESH_TTL = 14 * 24 * 3600;
const CODE_TTL = 300;
const CONSENT_TTL = 300;
const CLIENT_TTL = 365 * 24 * 3600;

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class McpOAuthService {
  private readonly oauth: OAuth2Server;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly mcpTokens: McpTokenService,
    private readonly resources: McpResourceService,
  ) {
    const model: OAuth2Server.AuthorizationCodeModel & OAuth2Server.RefreshTokenModel = {
      getClient: (id, secret) => this.getClient(id, secret),
      saveAuthorizationCode: (code, client, user) => this.saveCode(code, client, user),
      getAuthorizationCode: (code) => this.getCode(code),
      revokeAuthorizationCode: async (code) =>
        (await this.redis.del(`mcp:oauth:code:${digest(code.authorizationCode)}`)) > 0,
      validateScope: async (_user, _client, scope) =>
        scope?.length === 1 && scope[0] === "authoring" ? scope : false,
      validateRedirectUri: async (uri, client) => client.redirectUris?.includes(uri) ?? false,
      generateAccessToken: async () => randomBytes(32).toString("base64url"),
      generateRefreshToken: async () => randomBytes(32).toString("base64url"),
      saveToken: (token, client, user) => this.saveToken(token, client, user),
      getAccessToken: async (token) => {
        const actor = await this.mcpTokens.resolve(token);
        return actor
          ? {
              accessToken: token,
              accessTokenExpiresAt: new Date(actor.grant.expiresAt),
              client: { id: actor.grant.clientId, grants: ["authorization_code", "refresh_token"] },
              user: actor.grant,
              scope: actor.grant.scopes,
            }
          : false;
      },
      getRefreshToken: (token) => this.getRefreshToken(token),
      revokeToken: async (token) =>
        (await this.redis.del(`mcp:oauth:refresh:${digest(token.refreshToken)}`)) > 0,
    };
    this.oauth = new OAuth2Server({
      model,
      requireClientAuthentication: { authorization_code: false, refresh_token: false },
      accessTokenLifetime: ACCESS_TTL,
      refreshTokenLifetime: REFRESH_TTL,
      authorizationCodeLifetime: CODE_TTL,
    });
  }

  async metadata(req: Request) {
    const resource = await this.resources.fromRequest(req);
    return {
      resource: resource.url,
      authorization_servers: [resource.origin],
      bearer_methods_supported: ["header"],
      scopes_supported: ["authoring"],
    };
  }

  async serverMetadata(req: Request) {
    const { origin } = await this.resources.fromRequest(req);
    return {
      issuer: origin,
      authorization_endpoint: `${origin}/api/oauth/authorize`,
      token_endpoint: `${origin}/api/oauth/token`,
      registration_endpoint: `${origin}/api/oauth/register`,
      revocation_endpoint: `${origin}/api/oauth/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["authoring"],
    };
  }

  async register(req: Request, res: Response): Promise<void> {
    await this.resources.fromRequest(req);
    const body = req.body as Record<string, unknown> | undefined;
    const redirectUris = body?.redirect_uris;
    const name = body?.client_name;
    if (
      !Array.isArray(redirectUris) ||
      redirectUris.length < 1 ||
      redirectUris.length > 5 ||
      !redirectUris.every((uri) => typeof uri === "string" && this.validRedirectUri(uri)) ||
      (name !== undefined && (typeof name !== "string" || name.length > 100)) ||
      (body?.token_endpoint_auth_method !== undefined &&
        body.token_endpoint_auth_method !== "none") ||
      (body?.grant_types !== undefined &&
        (!Array.isArray(body.grant_types) ||
          body.grant_types.some(
            (grant) => !["authorization_code", "refresh_token"].includes(grant),
          ))) ||
      (body?.response_types !== undefined &&
        (!Array.isArray(body.response_types) ||
          body.response_types.some((responseType) => responseType !== "code")))
    ) {
      res.status(400).json({ error: "invalid_client_metadata" });
      return;
    }

    const id = randomBytes(24).toString("base64url");
    const client: McpClient = {
      id,
      name: typeof name === "string" && name ? name : "MCP client",
      redirectUris,
      grants: ["authorization_code", "refresh_token"],
      accessTokenLifetime: ACCESS_TTL,
      refreshTokenLifetime: REFRESH_TTL,
    };
    await this.redis.set(`mcp:oauth:client:${id}`, JSON.stringify(client), { EX: CLIENT_TTL });
    res.status(201).json({
      client_id: id,
      client_name: client.name,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: client.grants,
      response_types: ["code"],
    });
  }

  async authorizationPage(req: Request, res: Response): Promise<void> {
    const query = this.stringParams(req.query);
    const resource = await this.resources.fromRequest(req);
    const client = query.client_id ? await this.getClient(query.client_id, "") : null;
    if (
      !client ||
      !query.redirect_uri ||
      !client.redirectUris?.includes(query.redirect_uri) ||
      query.resource !== resource.url ||
      query.response_type !== "code" ||
      (query.scope !== undefined && query.scope !== "authoring") ||
      query.code_challenge_method !== "S256" ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(query.code_challenge ?? "") ||
      !query.state
    ) {
      res.setHeader("Cache-Control", "no-store");
      res.redirect(303, "/oauth/connect?error=invalid");
      return;
    }

    const user = await this.webUser(req);
    if (!user) {
      const loginUrl = new URL("/auth/login", resource.origin);
      loginUrl.searchParams.set("returnTo", req.originalUrl);
      res.setHeader("Cache-Control", "no-store");
      res.redirect(303, loginUrl.pathname + loginUrl.search);
      return;
    }

    const nonce = randomBytes(32).toString("base64url");
    await this.redis.set(
      `mcp:oauth:consent:${digest(nonce)}`,
      JSON.stringify({
        userId: user.userId,
        query: { ...query, scope: "authoring" },
      } satisfies ConsentRequest),
      { EX: CONSENT_TTL },
    );
    res.setHeader("Cache-Control", "no-store");
    res.redirect(303, `/oauth/connect?consent=${encodeURIComponent(nonce)}`);
  }

  async consentDetails(req: Request, nonce: string): Promise<McpConsentDetails> {
    const resource = await this.resources.fromRequest(req);
    const user = await this.webUser(req);
    if (!user) throw new UnauthorizedException("Connection requires sign in");
    const raw = await this.redis.get(`mcp:oauth:consent:${digest(nonce)}`);
    if (!raw) throw new NotFoundException("Connection request expired or invalid");
    const consent = JSON.parse(raw) as ConsentRequest;
    if (consent.userId !== user.userId || consent.query.resource !== resource.url) {
      throw new NotFoundException("Connection request expired or invalid");
    }
    const client = consent.query.client_id
      ? await this.getClient(consent.query.client_id, "")
      : false;
    if (!client) throw new NotFoundException("Connection request expired or invalid");
    return { clientName: client.name, accountEmail: user.email };
  }

  async authorize(req: Request, res: Response): Promise<void> {
    const nonce = typeof req.body?.consent === "string" ? req.body.consent : "";
    const raw = nonce
      ? await this.redis.sendCommand(["GETDEL", `mcp:oauth:consent:${digest(nonce)}`])
      : null;
    const resource = await this.resources.fromRequest(req);
    const user = await this.webUser(req);
    if (!raw || typeof raw !== "string" || !user) {
      res.status(401).json({ error: "invalid_request" });
      return;
    }
    const consent = JSON.parse(raw) as ConsentRequest;
    if (consent.userId !== user.userId || consent.query.resource !== resource.url) {
      res.status(403).json({ error: "access_denied" });
      return;
    }
    const decision = req.body?.decision;
    if (decision !== "approve" && decision !== "deny") {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const oauthRequest = new OAuth2Server.Request({
      method: "GET",
      headers: {},
      query: { ...consent.query, allowed: decision === "approve" ? "true" : "false" },
      body: {},
    });
    const oauthResponse = new OAuth2Server.Response();
    try {
      await this.oauth.authorize(oauthRequest, oauthResponse, {
        authenticateHandler: {
          handle: async () => ({ ...user, resource: resource.url }),
        },
      });
    } catch {
      // The OAuth library writes a safe redirect when the client redirect URI is valid.
    }
    const location = oauthResponse.headers?.location;
    if (location && this.validConsentRedirect(location, consent.query.redirect_uri)) {
      res.redirect(303, location);
      return;
    }
    res.status(400).json({ error: "invalid_request" });
  }

  async token(req: Request, res: Response): Promise<void> {
    const resource = await this.resources.fromRequest(req);
    if (req.body?.resource !== resource.url) {
      res.status(400).json({ error: "invalid_target" });
      return;
    }
    if (req.body?.grant_type === "authorization_code") {
      const code = typeof req.body.code === "string" ? await this.getCode(req.body.code) : false;
      if (!code || (code.user as McpUser).resource !== resource.url) {
        res.status(400).json({ error: "invalid_grant" });
        return;
      }
    }
    if (req.body?.grant_type === "refresh_token") {
      const refresh =
        typeof req.body.refresh_token === "string"
          ? await this.getRefreshToken(req.body.refresh_token)
          : false;
      if (!refresh || (refresh.user as McpUser).resource !== resource.url) {
        res.status(400).json({ error: "invalid_grant" });
        return;
      }
    }
    const oauthRequest = new OAuth2Server.Request(req);
    const oauthResponse = new OAuth2Server.Response();
    try {
      await this.oauth.token(oauthRequest, oauthResponse);
    } catch {
      // OAuth errors and status are generated by the library.
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.status(oauthResponse.status ?? 500).json(oauthResponse.body ?? { error: "server_error" });
  }

  async revoke(req: Request, res: Response): Promise<void> {
    const resource = await this.resources.fromRequest(req);
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const clientId = typeof req.body?.client_id === "string" ? req.body.client_id : "";
    const client = clientId ? await this.getClient(clientId, "") : null;
    if (!client || !token) {
      res.status(400).json({ error: "invalid_client" });
      return;
    }
    const refresh = await this.getRefreshToken(token);
    if (
      refresh &&
      refresh.client.id === clientId &&
      (refresh.user as McpUser).resource === resource.url
    ) {
      await this.redis.del(`mcp:oauth:refresh:${digest(token)}`);
    } else {
      const actor = await this.mcpTokens.resolve(token);
      if (actor && actor.grant.clientId === clientId && actor.grant.resource === resource.url) {
        await this.mcpTokens.revoke(token);
      }
    }
    res.status(200).end();
  }

  private validRedirectUri(raw: string): boolean {
    if (raw.length > 2048) return false;
    try {
      const uri = new URL(raw);
      if (uri.hash || uri.username || uri.password) return false;
      if (uri.protocol === "https:") return true;
      return uri.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(uri.hostname);
    } catch {
      return false;
    }
  }

  private validConsentRedirect(location: string, expected: string): boolean {
    try {
      const actual = new URL(location);
      const target = new URL(expected);
      return actual.origin === target.origin && actual.pathname === target.pathname;
    } catch {
      return false;
    }
  }

  private stringParams(query: Request["query"]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === "string") result[key] = value;
      if (
        key === "resource" &&
        Array.isArray(value) &&
        typeof value[0] === "string" &&
        value.every((item) => item === value[0])
      ) {
        result[key] = value[0];
      }
    }
    return result;
  }

  private async webUser(req: Request): Promise<(McpUser & { email: string }) | null> {
    const token = req.cookies?.access_token;
    if (typeof token !== "string") return null;
    try {
      const payload = await this.jwt.verifyAsync<{ userId: string; tenantId: string }>(token, {
        secret: this.config.get<string>("jwt.secret"),
      });
      const resource = await this.resources.fromRequest(req);
      if (payload.tenantId !== resource.tenantId) return null;
      const email = await this.mcpTokens.resolveIdentity(payload.userId, payload.tenantId);
      return email
        ? { userId: payload.userId, tenantId: payload.tenantId, resource: resource.url, email }
        : null;
    } catch {
      return null;
    }
  }

  private async getClient(id: string, secret: string | null): Promise<McpClient | false> {
    if (secret) return false;
    const key = `mcp:oauth:client:${id}`;
    const raw = await this.redis.get(key);
    if (raw) await this.redis.expire(key, CLIENT_TTL);
    return raw ? (JSON.parse(raw) as McpClient) : false;
  }

  private async saveCode(
    code: Pick<
      OAuth2Server.AuthorizationCode,
      | "authorizationCode"
      | "expiresAt"
      | "redirectUri"
      | "scope"
      | "codeChallenge"
      | "codeChallengeMethod"
    >,
    client: OAuth2Server.Client,
    user: OAuth2Server.User,
  ): Promise<OAuth2Server.AuthorizationCode> {
    const result = { ...code, client, user } as OAuth2Server.AuthorizationCode;
    await this.redis.set(
      `mcp:oauth:code:${digest(code.authorizationCode)}`,
      JSON.stringify(result),
      { EX: CODE_TTL },
    );
    return result;
  }

  private async getCode(code: string): Promise<OAuth2Server.AuthorizationCode | false> {
    const raw = await this.redis.get(`mcp:oauth:code:${digest(code)}`);
    if (!raw) return false;
    const stored = JSON.parse(raw) as StoredCode;
    return { ...stored, expiresAt: new Date(stored.expiresAt) } as OAuth2Server.AuthorizationCode;
  }

  private async saveToken(
    token: OAuth2Server.Token,
    client: OAuth2Server.Client,
    user: OAuth2Server.User,
  ): Promise<OAuth2Server.Token> {
    const mcpUser = user as McpUser;
    const email = await this.mcpTokens.resolveIdentity(mcpUser.userId, mcpUser.tenantId);
    const resource = await this.resources.forTenant(mcpUser.tenantId);
    if (!email || mcpUser.resource !== resource.url) throw new Error("MCP authorization revoked");
    await this.mcpTokens.store(token.accessToken, {
      userId: mcpUser.userId,
      tenantId: mcpUser.tenantId,
      clientId: client.id,
      resource: mcpUser.resource,
      scopes: token.scope ?? ["authoring"],
    });
    if (token.refreshToken && token.refreshTokenExpiresAt) {
      const refresh: OAuth2Server.RefreshToken = {
        refreshToken: token.refreshToken,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        client,
        user,
        scope: token.scope,
      };
      await this.redis.set(
        `mcp:oauth:refresh:${digest(token.refreshToken)}`,
        JSON.stringify(refresh),
        { EX: REFRESH_TTL },
      );
    }
    return { ...token, client, user };
  }

  private async getRefreshToken(token: string): Promise<OAuth2Server.RefreshToken | false> {
    const raw = await this.redis.get(`mcp:oauth:refresh:${digest(token)}`);
    if (!raw) return false;
    const stored = JSON.parse(raw) as StoredRefresh;
    if (new Date(stored.refreshTokenExpiresAt).getTime() <= Date.now()) return false;
    if (
      !(await this.mcpTokens.resolveIdentity(
        (stored.user as McpUser).userId,
        (stored.user as McpUser).tenantId,
      ))
    )
      return false;
    return {
      ...stored,
      refreshTokenExpiresAt: new Date(stored.refreshTokenExpiresAt),
    } as OAuth2Server.RefreshToken;
  }
}
