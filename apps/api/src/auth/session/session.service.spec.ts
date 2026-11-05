import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AUTH_TOKEN_PURPOSE } from "@repo/shared";

import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";

import { AUTH_TOKEN_VERSION } from "./session.constants";
import { SessionService } from "./session.service";

import type { MfaRepository } from "./mfa.repository";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { SessionRevocationService } from "src/redis";
import type { RedisClient } from "src/redis/redis.types";

describe("Session authentication boundaries", () => {
  const jwt = new JwtService();
  const config = new ConfigService({
    jwt: { secret: "access-secret", refreshSecret: "refresh-secret" },
  });
  const identity = {
    userId: "11111111-1111-4111-8111-111111111111",
    tenantId: "22222222-2222-4222-8222-222222222222",
    email: "user@example.com",
  };
  const policy = jest.fn();
  const get = jest.fn();
  const set = jest.fn();
  const assertActive = jest.fn();
  let sessionService: SessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    policy.mockResolvedValue({ required: true, enabled: true });
    get.mockResolvedValue(JSON.stringify(identity));
    assertActive.mockResolvedValue(undefined);
    sessionService = new SessionService(
      jwt,
      config,
      { getUserMfaPolicy: policy } as unknown as MfaRepository,
      {
        assertUserSessionVersion: assertActive,
        assertSessionActive: assertActive,
        getOrCreateUserSessionVersion: async () => "v".repeat(32),
      } as unknown as SessionRevocationService,
      { get, set } as unknown as RedisClient,
    );
  });

  async function fullToken(mfaVerified: boolean, extra: object = {}) {
    return jwt.signAsync(
      {
        ...identity,
        sessionId: "s".repeat(32),
        sessionVersion: "v".repeat(32),
        tokenVersion: AUTH_TOKEN_VERSION,
        tokenPurpose: AUTH_TOKEN_PURPOSE.ACCESS,
        jti: "unique-token-id-12345",
        mfaVerified,
        permissions: [],
        roleSlugs: [],
        ...extra,
      },
      { secret: "access-secret", expiresIn: 60 },
    );
  }

  it("keeps claims about roles, permissions, and prior assurance out of challenge tokens", async () => {
    const tokens = await sessionService.createMfaChallenge(
      {
        ...identity,
        permissions: ["admin"],
        roleSlugs: ["admin"],
        mfaVerified: true,
      } as typeof identity,
      { rememberMe: true },
    );
    const claims = jwt.decode(tokens.accessToken) as Record<string, unknown>;
    expect(claims).not.toHaveProperty("permissions");
    expect(claims).not.toHaveProperty("roleSlugs");
    expect(claims.mfaVerified).toBe(false);
    expect(tokens.refreshToken).toBe("");
    expect(Number(claims.exp) - Number(claims.iat)).toBe(300);
    await expect(
      sessionService.verifySessionToken(tokens.accessToken, AUTH_TOKEN_PURPOSE.ACCESS),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      sessionService.verifySessionToken(tokens.accessToken, AUTH_TOKEN_PURPOSE.ACCESS, true),
    ).resolves.toMatchObject({
      tokenPurpose: AUTH_TOKEN_PURPOSE.MFA,
      permissions: [],
      roleSlugs: [],
    });
  });

  it("validates a full session with one combined registry check", async () => {
    await sessionService.verifySessionToken(await fullToken(true), AUTH_TOKEN_PURPOSE.ACCESS);
    expect(assertActive).toHaveBeenCalledTimes(1);
  });

  it("checks live policy even when an access token was issued before MFA became required", async () => {
    const token = await fullToken(false);
    policy.mockResolvedValueOnce({ required: false });
    await expect(
      sessionService.verifySessionToken(token, AUTH_TOKEN_PURPOSE.ACCESS),
    ).resolves.toBeDefined();
    await expect(
      sessionService.verifySessionToken(token, AUTH_TOKEN_PURPOSE.ACCESS),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      sessionService.verifySessionToken(await fullToken(true), AUTH_TOKEN_PURPOSE.ACCESS),
    ).resolves.toBeDefined();
  });

  it("rejects missing version, incorrect purpose, expired credentials, and revoked users", async () => {
    for (const extra of [
      { tokenVersion: 1 },
      { tokenPurpose: AUTH_TOKEN_PURPOSE.REFRESH },
      { mfaVerified: "true" },
      { exp: 1 },
    ]) {
      const token = await jwt.signAsync(
        {
          ...identity,
          sessionId: "s".repeat(32),
          sessionVersion: "v".repeat(32),
          tokenVersion: AUTH_TOKEN_VERSION,
          tokenPurpose: AUTH_TOKEN_PURPOSE.ACCESS,
          jti: "unique-token-id-12345",
          mfaVerified: true,
          permissions: [],
          roleSlugs: [],
          exp: Math.floor(Date.now() / 1000) + 60,
          ...extra,
        },
        { secret: "access-secret" },
      );
      await expect(
        sessionService.verifySessionToken(token, AUTH_TOKEN_PURPOSE.ACCESS),
      ).rejects.toThrow();
    }
    assertActive.mockRejectedValue(new UnauthorizedException());
    await expect(
      sessionService.verifySessionToken(await fullToken(true), AUTH_TOKEN_PURPOSE.ACCESS),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("does not attach pending identities on public routes", async () => {
    const { accessToken } = await sessionService.createMfaChallenge(identity);
    const request = { cookies: { access_token: accessToken }, headers: {}, user: undefined };
    const reflector = { getAllAndOverride: jest.fn((key) => key === "isPublic") };
    const guard = new JwtAuthGuard(
      sessionService,
      reflector as unknown as Reflector,
      {} as never,
      { resolveTenantId: jest.fn() } as never,
    );
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeNull();
  });

  it("fails closed when challenge state has expired or Redis is unavailable", async () => {
    const { accessToken } = await sessionService.createMfaChallenge(identity);
    get.mockResolvedValueOnce(null);
    await expect(
      sessionService.verifySessionToken(accessToken, AUTH_TOKEN_PURPOSE.ACCESS, true),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    get.mockRejectedValueOnce(new Error("Redis unavailable"));
    await expect(
      sessionService.verifySessionToken(accessToken, AUTH_TOKEN_PURPOSE.ACCESS, true),
    ).rejects.toThrow();
  });

  it("requires support-session evidence and checks the original operator's policy", async () => {
    const token = await fullToken(false, {
      isSupportMode: true,
      supportSessionId: "33333333-3333-4333-8333-333333333333",
      supportExpiresAt: new Date(Date.now() + 60000).toISOString(),
      originalUserId: identity.userId,
      originalTenantId: identity.tenantId,
    });
    get.mockResolvedValueOnce(null);
    await expect(
      sessionService.verifySessionToken(token, AUTH_TOKEN_PURPOSE.ACCESS),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    get.mockResolvedValueOnce(JSON.stringify({ ...identity, mfaVerified: false }));
    await expect(
      sessionService.verifySessionToken(token, AUTH_TOKEN_PURPOSE.ACCESS),
    ).rejects.toBeInstanceOf(ForbiddenException);
    get.mockResolvedValueOnce(JSON.stringify({ ...identity, mfaVerified: true }));
    await expect(
      sessionService.verifySessionToken(token, AUTH_TOKEN_PURPOSE.ACCESS),
    ).resolves.toBeDefined();
    expect(policy).toHaveBeenCalledWith(identity.tenantId, identity.userId);
  });
});
