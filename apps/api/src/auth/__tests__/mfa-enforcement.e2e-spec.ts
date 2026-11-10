import { randomUUID } from "node:crypto";

import { PATH_METADATA } from "@nestjs/common/constants";
import { ConfigService } from "@nestjs/config";
import { MetadataScanner, ModulesContainer, Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import {
  VIDEO_PROVIDERS,
  AUTH_SESSION_STATUS,
  AUTH_TOKEN_PURPOSE,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { eq, isNull, sql } from "drizzle-orm";
import { authenticator } from "otplib";
import request from "supertest";

import { REFRESH_TOKEN_EXPIRATION_SECONDS } from "src/auth/consts";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { FileGuard } from "src/file/guards/file.guard";
import { VideoProcessingStateService } from "src/file/video-processing-state.service";
import { McpUploadGrantService } from "src/mcp/mcp-upload-grant.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { PermissionsService } from "src/permissions/permissions.service";
import { SessionRevocationService } from "src/redis";
import { REDIS_CLIENT } from "src/redis/redis.tokens";
import { S3Service } from "src/s3/s3.service";
import { DEFAULT_ADMIN_SETTINGS } from "src/settings/constants/settings.constants";
import { SettingsService } from "src/settings/settings.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";
import { credentials, settings } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";
import { WsJwtGuard } from "src/websocket/guards/ws-jwt.guard";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createUserFactory } from "../../../test/factory/user.factory";
import { truncateAllTables } from "../../../test/helpers/test-helpers";
import { AuthService } from "../auth.service";
import { ALLOW_MFA } from "../session/allow-mfa.decorator";
import { AUTH_TOKEN_VERSION } from "../session/session.constants";
import { SessionService } from "../session/session.service";

import type { ExecutionContext, INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { RedisClient } from "src/redis/redis.types";

describe("MFA enforcement", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let auth: AuthService;
  let sessionService: SessionService;
  let factory: ReturnType<typeof createUserFactory>;
  const password = "Password123@";
  const previousRateLimitSetting = process.env.DISABLE_RATE_LIMITING;

  beforeAll(async () => {
    process.env.DISABLE_RATE_LIMITING = "true";
    ({ app } = await createE2ETest({
      customProviders: [
        {
          provide: S3Service,
          useValue: {
            uploadMultipartPart: jest.fn().mockResolvedValue("review-etag"),
            completeMultipartUpload: jest.fn().mockResolvedValue(undefined),
            getSignedUrl: jest.fn().mockResolvedValue("https://storage.example.test/review-file"),
          },
        },
        { provide: OutboxPublisher, useValue: { publish: jest.fn().mockResolvedValue(undefined) } },
      ],
    }));
    db = app.get(DB);
    auth = app.get(AuthService);
    sessionService = app.get(SessionService);
    factory = createUserFactory(db);
  });
  beforeEach(async () => {
    await truncateAllTables(app.get(DB_ADMIN), db);
  });
  afterAll(async () => {
    if (previousRateLimitSetting === undefined) delete process.env.DISABLE_RATE_LIMITING;
    else process.env.DISABLE_RATE_LIMITING = previousRateLimitSetting;
    await app?.close();
  });

  async function createAccount(
    enabled = true,
    settingsMethod:
      | "withAdminSettings"
      | "withUserSettings"
      | "withContentCreatorSettings"
      | "withTrainerSettings" = "withAdminSettings",
  ) {
    const user = await factory[settingsMethod](db).withCredentials({ password }).create();
    const secret = authenticator.generateSecret();
    await db
      .update(settings)
      .set({
        settings: settingsToJSONBuildObject({
          ...DEFAULT_ADMIN_SETTINGS,
          isMFAEnabled: enabled,
          MFASecret: enabled ? secret : null,
        }),
      })
      .where(eq(settings.userId, user.id));
    return { user, secret };
  }

  function tokenFrom(response: request.Response) {
    const cookies = response.headers["set-cookie"] as unknown as string[];
    return cookies
      .filter((value) => value.startsWith("access_token="))
      .pop()!
      .split(";")[0]
      .slice("access_token=".length);
  }

  it("matches registry expiry to refresh tokens and honors shorter session lifetimes", async () => {
    const { user } = await createAccount(false);
    const tokens = await auth.login({ email: user.email, password });
    const claims = await sessionService.verifySessionToken(
      tokens.refreshToken,
      AUTH_TOKEN_PURPOSE.REFRESH,
    );
    const redis = app.get<RedisClient>(REDIS_CLIENT);
    const key = `auth:session:${user.id}:${claims.sessionId}`;
    expect(claims.exp - Number(claims.iat)).toBe(REFRESH_TOKEN_EXPIRATION_SECONDS);
    expect(await redis.ttl(key)).toBeGreaterThan(REFRESH_TOKEN_EXPIRATION_SECONDS - 5);
    expect(await redis.ttl(key)).toBeLessThanOrEqual(REFRESH_TOKEN_EXPIRATION_SECONDS);

    const registry = app.get(SessionRevocationService);
    const shortSession = await registry.createSession(user.id, claims.sessionVersion, 60);
    const shortKey = `auth:session:${user.id}:${shortSession.sessionId}`;
    expect(await redis.ttl(shortKey)).toBeGreaterThan(55);
    expect(await redis.ttl(shortKey)).toBeLessThanOrEqual(60);
    await registry.extendSession({ userId: user.id, ...shortSession }, 30);
    expect(await redis.ttl(shortKey)).toBeGreaterThan(25);
    expect(await redis.ttl(shortKey)).toBeLessThanOrEqual(30);
  });

  it("revokes the access/refresh family on logout without revoking other logins", async () => {
    const { user } = await createAccount(false);
    const first = await auth.login({ email: user.email, password });
    const second = await auth.login({ email: user.email, password });
    const refreshed = await auth.refreshTokens(first.refreshToken);
    const firstClaims = await sessionService.verifySessionToken(
      first.accessToken,
      AUTH_TOKEN_PURPOSE.ACCESS,
    );
    const refreshedClaims = await sessionService.verifySessionToken(
      refreshed.accessToken,
      AUTH_TOKEN_PURPOSE.ACCESS,
    );
    expect(refreshedClaims.sessionId).toBe(firstClaims.sessionId);
    await request(app.getHttpServer())
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(201);
    for (const token of [first.accessToken, refreshed.accessToken]) {
      await request(app.getHttpServer())
        .get("/api/auth/current-user")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
    }
    for (const token of [first.refreshToken, refreshed.refreshToken]) {
      await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .set("Cookie", `refresh_token=${token}`)
        .expect(403);
    }
    await expect(app.get(SessionRevocationService).extendSession(firstClaims)).rejects.toThrow();
    await request(app.getHttpServer())
      .get("/api/auth/current-user")
      .set("Authorization", `Bearer ${second.accessToken}`)
      .expect(200);
  });

  it.each(["challenge", "setup"])(
    "revokes the replaced session when entering MFA through %s, including after logout",
    async (route) => {
      const { user } = await createAccount(false);
      const original = await auth.login({ email: user.email, password });
      const other = await auth.login({ email: user.email, password });
      const refreshed = await auth.refreshTokens(original.refreshToken);
      const pending = await request(app.getHttpServer())
        .post(`/api/auth/mfa/${route}`)
        .set("Authorization", `Bearer ${original.accessToken}`)
        .expect(201);
      const pendingToken = tokenFrom(pending);

      const assertOriginalSessionRevoked = async () => {
        for (const tokens of [original, refreshed]) {
          await request(app.getHttpServer())
            .get("/api/auth/current-user")
            .set("Authorization", `Bearer ${tokens.accessToken}`)
            .expect(401);
          await request(app.getHttpServer())
            .post("/api/auth/refresh")
            .set("Cookie", `refresh_token=${tokens.refreshToken}`)
            .expect(403);
        }
      };

      await assertOriginalSessionRevoked();
      await request(app.getHttpServer())
        .get("/api/auth/session")
        .set("Authorization", `Bearer ${pendingToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${pendingToken}`)
        .expect(201);
      await assertOriginalSessionRevoked();
      await request(app.getHttpServer())
        .get("/api/auth/session")
        .set("Authorization", `Bearer ${pendingToken}`)
        .expect(401);
      await request(app.getHttpServer())
        .get("/api/auth/current-user")
        .set("Authorization", `Bearer ${other.accessToken}`)
        .expect(200);
    },
  );

  it("can complete enrollment after revoking the session replaced by MFA", async () => {
    const { user } = await createAccount(false);
    const original = await auth.login({ email: user.email, password });
    const setup = await request(app.getHttpServer())
      .post("/api/auth/mfa/setup")
      .set("Authorization", `Bearer ${original.accessToken}`)
      .expect(201);
    const verified = await request(app.getHttpServer())
      .post("/api/auth/mfa/verify")
      .set("Authorization", `Bearer ${tokenFrom(setup)}`)
      .send({ token: authenticator.generate(setup.body.data.secret) })
      .expect(201);
    await request(app.getHttpServer())
      .get("/api/auth/current-user")
      .set("Authorization", `Bearer ${tokenFrom(verified)}`)
      .expect(200);
    await expect(auth.refreshTokens(original.refreshToken)).rejects.toThrow();
  });

  it("never revives revoked verified credentials after a new first-factor login", async () => {
    const { user, secret } = await createAccount();
    const first = await auth.login({ email: user.email, password });
    const verified = await request(app.getHttpServer())
      .post("/api/auth/mfa/verify")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .send({ token: authenticator.generate(secret) })
      .expect(201);
    const oldToken = tokenFrom(verified);
    await app.get(SessionRevocationService).revokeUserSessions(user.id);
    await request(app.getHttpServer())
      .get("/api/auth/current-user")
      .set("Authorization", `Bearer ${oldToken}`)
      .expect(401);
    const pending = await auth.login({ email: user.email, password });
    expect(pending.shouldVerifyMFA).toBe(true);
    await request(app.getHttpServer())
      .get("/api/auth/current-user")
      .set("Authorization", `Bearer ${oldToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .get("/api/auth/session")
      .set("Authorization", `Bearer ${pending.accessToken}`)
      .expect(200);
    await app.get(SessionRevocationService).revokeUserSessions(user.id);
    await request(app.getHttpServer())
      .post("/api/auth/mfa/verify")
      .set("Authorization", `Bearer ${pending.accessToken}`)
      .send({ token: authenticator.generate(secret) })
      .expect(401);
  });

  it("does not recreate a revoked session when logout races refresh", async () => {
    const { user } = await createAccount(false);
    const login = await auth.login({ email: user.email, password });
    const results = await Promise.allSettled([
      auth.refreshTokens(login.refreshToken),
      request(app.getHttpServer())
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${login.accessToken}`)
        .expect(201),
    ]);
    expect(results[1].status).toBe("fulfilled");
    await expect(
      sessionService.verifySessionToken(login.accessToken, AUTH_TOKEN_PURPOSE.ACCESS),
    ).rejects.toThrow();
    if (results[0].status === "fulfilled") {
      await expect(
        sessionService.verifySessionToken(results[0].value.accessToken, AUTH_TOKEN_PURPOSE.ACCESS),
      ).rejects.toThrow();
      await expect(auth.refreshTokens(results[0].value.refreshToken)).rejects.toThrow();
    }
  });

  it("restricts all TUS operations to the fully authenticated owner and tenant", async () => {
    const { user: owner } = await createAccount(false);
    const { user: other } = await createAccount(false);
    const { user: pendingUser } = await createAccount();
    const ownerLogin = await auth.login({ email: owner.email, password });
    const otherLogin = await auth.login({ email: other.email, password });
    const pendingLogin = await auth.login({ email: pendingUser.email, password });
    const uploadId = randomUUID();
    const videoState = app.get(VideoProcessingStateService);
    await videoState.initializeState(uploadId, "review-placeholder", "mp4", owner.id, {
      tenantId: owner.tenantId,
      provider: VIDEO_PROVIDERS.S3,
      fileKey: `${owner.tenantId}/review-file`,
      multipartUploadId: "review-multipart",
    });
    const create = (token?: string) => {
      const req = request(app.getHttpServer())
        .post("/api/file/videos/tus")
        .set("Tus-Resumable", "1.0.0")
        .set("Upload-Length", "24")
        .set("Upload-Metadata", `uploadId ${Buffer.from(uploadId).toString("base64")}`);
      return token ? req.set("Authorization", `Bearer ${token}`) : req;
    };
    await create().expect(401);
    await create(pendingLogin.accessToken).expect(403);
    await create(otherLogin.accessToken).expect(403);
    await create(ownerLogin.accessToken).expect(201);
    for (const method of ["head", "patch"] as const) {
      for (const [token, status] of [
        [undefined, 401],
        [pendingLogin.accessToken, 403],
        [otherLogin.accessToken, 403],
      ] as const) {
        const req = request(app.getHttpServer())
          [method](`/api/file/videos/tus/${uploadId}`)
          .set("Tus-Resumable", "1.0.0")
          .set("Upload-Offset", "0");
        if (token) req.set("Authorization", `Bearer ${token}`);
        if (method === "patch")
          req.set("Content-Type", "application/offset+octet-stream").send(Buffer.alloc(24));
        await req.expect(status);
      }
    }
    await request(app.getHttpServer())
      .head(`/api/file/videos/tus/${uploadId}`)
      .set("Authorization", `Bearer ${ownerLogin.accessToken}`)
      .set("Tus-Resumable", "1.0.0")
      .expect(200);
    await videoState
      .initializeState(randomUUID(), "other-tenant", "mp4", owner.id, {
        tenantId: randomUUID(),
        provider: VIDEO_PROVIDERS.S3,
        fileKey: "other/file",
        multipartUploadId: "other-multipart",
      })
      .then(async (state) => {
        await request(app.getHttpServer())
          .post("/api/file/videos/tus")
          .set("Authorization", `Bearer ${ownerLogin.accessToken}`)
          .set("Tus-Resumable", "1.0.0")
          .set("Upload-Length", "24")
          .set("Upload-Metadata", `uploadId ${Buffer.from(state.uploadId).toString("base64")}`)
          .expect(403);
      });
    const storage = app.get(S3Service);
    const upload = jest.spyOn(storage, "uploadMultipartPart").mockResolvedValue("review-etag");
    const complete = jest.spyOn(storage, "completeMultipartUpload").mockResolvedValue(undefined);
    const signedUrl = jest
      .spyOn(storage, "getSignedUrl")
      .mockResolvedValue("https://storage.example.test/review-file");
    const mime = jest
      .spyOn(FileGuard, "getFileType")
      .mockResolvedValue({ ext: "mp4", mime: "video/mp4" });
    try {
      await request(app.getHttpServer())
        .patch(`/api/file/videos/tus/${uploadId}`)
        .set("Authorization", `Bearer ${ownerLogin.accessToken}`)
        .set("Tus-Resumable", "1.0.0")
        .set("Upload-Offset", "0")
        .set("Content-Type", "application/offset+octet-stream")
        .send(Buffer.alloc(24))
        .expect(204);
      expect(upload).toHaveBeenCalledTimes(1);
    } finally {
      upload.mockRestore();
      complete.mockRestore();
      signedUrl.mockRestore();
      mime.mockRestore();
    }
  });

  it("denies pending MFA credentials on every registered protected controller handler", async () => {
    const { user } = await createAccount();
    const { accessToken } = await auth.login({ email: user.email, password });
    const reflector = new Reflector();
    const guard = new JwtAuthGuard(
      sessionService,
      reflector,
      app.get(McpUploadGrantService),
      app.get(TenantResolverService),
    );
    const scanner = new MetadataScanner();
    let protectedHandlers = 0;
    const allowedHandlers: string[] = [];
    for (const module of app.get(ModulesContainer).values()) {
      for (const controller of module.controllers.values()) {
        const instance = controller.instance;
        if (!instance) continue;
        for (const name of scanner.getAllMethodNames(Object.getPrototypeOf(instance))) {
          const handler = Reflect.get(instance, name);
          if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue;
          const targets = [handler, controller.metatype];
          if (reflector.getAllAndOverride(ALLOW_MFA, targets)) {
            allowedHandlers.push(`${controller.metatype.name}.${name}`);
            continue;
          }
          if (reflector.getAllAndOverride("isPublic", targets)) continue;
          const req = { headers: { authorization: `Bearer ${accessToken}` } };
          const context = {
            getHandler: () => handler,
            getClass: () => controller.metatype,
            switchToHttp: () => ({ getRequest: () => req }),
          } as unknown as ExecutionContext;
          await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403 });
          protectedHandlers++;
        }
      }
    }
    expect(protectedHandlers).toBeGreaterThan(100);
    expect(allowedHandlers.sort()).toEqual(
      [
        "AuthController.logout",
        "AuthController.mfaChallenge",
        "AuthController.MFASetup",
        "AuthController.MFAVerify",
        "AuthController.session",
      ].sort(),
    );
  });

  it.each([
    "withAdminSettings",
    "withUserSettings",
    "withContentCreatorSettings",
    "withTrainerSettings",
  ] as const)(
    "restores exactly assigned permissions after MFA and refresh for %s",
    async (settingsMethod) => {
      const { user, secret } = await createAccount(true, settingsMethod);
      const expected = await app.get(PermissionsService).getUserAccess(user.id);
      expect(expected.permissions.length).toBeGreaterThan(0);
      const login = await auth.login({ email: user.email, password });
      const verified = await request(app.getHttpServer())
        .post("/api/auth/mfa/verify")
        .set("Authorization", `Bearer ${login.accessToken}`)
        .send({ token: authenticator.generate(secret) })
        .expect(201);
      const accessToken = tokenFrom(verified);
      const claims = await sessionService.verifySessionToken(
        accessToken,
        AUTH_TOKEN_PURPOSE.ACCESS,
      );
      expect(claims.mfaVerified).toBe(true);
      expect([...claims.permissions].sort()).toEqual([...expected.permissions].sort());
      expect([...claims.roleSlugs].sort()).toEqual([...expected.roleSlugs].sort());
      const current = await request(app.getHttpServer())
        .get("/api/auth/current-user")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect([...current.body.data.permissions].sort()).toEqual([...expected.permissions].sort());
      const refreshCookie = (verified.headers["set-cookie"] as unknown as string[])
        .filter((cookie) => cookie.startsWith("refresh_token="))
        .pop()!
        .split(";")[0];
      const refreshed = await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .set("Cookie", refreshCookie)
        .expect(201);
      const refreshedClaims = await sessionService.verifySessionToken(
        tokenFrom(refreshed),
        AUTH_TOKEN_PURPOSE.ACCESS,
      );
      expect(refreshedClaims.mfaVerified).toBe(true);
      expect([...refreshedClaims.permissions].sort()).toEqual([...expected.permissions].sort());
      if (settingsMethod === "withUserSettings") {
        await request(app.getHttpServer())
          .get("/api/user/all")
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(403);
      }
    },
  );

  it.each(["password", "provider", "magic-link"])(
    "denies access and refresh before MFA, then grants access after %s login",
    async (method) => {
      const { user, secret } = await createAccount();
      let accessToken: string;
      if (method === "password") {
        const response = await request(app.getHttpServer())
          .post("/api/auth/login")
          .send({ email: user.email, password, rememberMe: false })
          .expect(201);
        accessToken = tokenFrom(response);
        expect(response.body.data.shouldVerifyMFA).toBe(true);
        expect(response.headers["set-cookie"]).toEqual(
          expect.arrayContaining([expect.stringMatching(/^refresh_token=;/)]),
        );
      } else if (method === "provider") {
        const result = await auth.handleProviderLoginCallback({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        });
        accessToken = result.accessToken;
        expect(result.refreshToken).toBe("");
      } else {
        const token = await auth.createMagicLinkToken(user.id);
        const response = await request(app.getHttpServer())
          .get("/api/auth/magic-link/verify")
          .query({ token })
          .expect(200);
        accessToken = tokenFrom(response);
      }
      const payload = app.get(JwtService).decode(accessToken) as Record<string, number | string>;
      expect(payload).toMatchObject({
        tokenVersion: AUTH_TOKEN_VERSION,
        tokenPurpose: AUTH_TOKEN_PURPOSE.MFA,
        mfaVerified: false,
      });
      expect(payload).not.toHaveProperty("permissions");
      expect(payload).not.toHaveProperty("roleSlugs");
      expect(Number(payload.exp) - Number(payload.iat)).toBe(300);
      for (const path of ["/api/user/all", "/api/auth/current-user", "/api/settings"]) {
        await request(app.getHttpServer())
          .get(path)
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(403);
        await request(app.getHttpServer())
          .get(path)
          .set("Cookie", `access_token=${accessToken}`)
          .expect(403);
      }
      await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .set("Cookie", `refresh_token=${accessToken}`)
        .expect(403);
      const refreshSecret = app.get(ConfigService).getOrThrow<string>("jwt.refreshSecret");
      const pendingRefresh = await new JwtService().signAsync(payload, { secret: refreshSecret });
      await expect(auth.refreshTokens(pendingRefresh)).rejects.toThrow();
      await request(app.getHttpServer())
        .post("/api/auth/mfa/setup")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(403);
      const response = await request(app.getHttpServer())
        .post("/api/auth/mfa/verify")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ token: authenticator.generate(secret) })
        .expect(201);
      const verified = tokenFrom(response);
      await request(app.getHttpServer())
        .get("/api/user/all")
        .set("Authorization", `Bearer ${verified}`)
        .expect(200);
      const currentUser = await request(app.getHttpServer())
        .get("/api/auth/current-user")
        .set("Authorization", `Bearer ${verified}`)
        .expect(200);
      expect(currentUser.body.data.shouldVerifyMFA).toBe(false);
      await request(app.getHttpServer())
        .post("/api/auth/mfa/verify")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ token: authenticator.generate(secret) })
        .expect(401);
      const userSettings = await request(app.getHttpServer())
        .get("/api/settings")
        .set("Authorization", `Bearer ${verified}`)
        .expect(200);
      expect(userSettings.body.data).not.toHaveProperty("MFASecret");
      for (const body of [{ MFASecret: "attacker" }, { isMFAEnabled: false }]) {
        const update = await request(app.getHttpServer())
          .put("/api/settings")
          .set("Authorization", `Bearer ${verified}`)
          .send(body);
        expect(update.status).toBeGreaterThanOrEqual(400);
      }
    },
  );

  it("supports first enrollment without disclosing the active secret or replacing it", async () => {
    const { user } = await createAccount(false);
    await app.get(SettingsService).updateMFAEnforcedRoles({ [SYSTEM_ROLE_SLUGS.ADMIN]: true });
    const login = await auth.login({ email: user.email, password });
    const setup = () =>
      request(app.getHttpServer())
        .post("/api/auth/mfa/setup")
        .set("Authorization", `Bearer ${login.accessToken}`);
    const response = await setup().expect(201);
    expect((await setup()).body.data.secret).toBe(response.body.data.secret);
    expect((await app.get(SettingsService).getUserSettings(user.id)).isMFAEnabled).toBe(false);
    await request(app.getHttpServer())
      .post("/api/auth/mfa/verify")
      .set("Authorization", `Bearer ${login.accessToken}`)
      .send({ token: authenticator.generate(response.body.data.secret) })
      .expect(201);
    expect((await app.get(SettingsService).getUserSettings(user.id)).isMFAEnabled).toBe(true);
    const second = await auth.login({ email: user.email, password });
    await request(app.getHttpServer())
      .post("/api/auth/mfa/setup")
      .set("Authorization", `Bearer ${second.accessToken}`)
      .expect(403);
  });

  it("completes setup for an admin who enforced MFA on their own signed-in session", async () => {
    const { user } = await createAccount(false);
    const login = await auth.login({ email: user.email, password });
    let cookie = `access_token=${login.accessToken}`;
    const withCookie = (call: request.Test) => call.set("Cookie", cookie);

    await withCookie(request(app.getHttpServer()).patch("/api/settings/admin/mfa-enforced-roles"))
      .send({ [SYSTEM_ROLE_SLUGS.ADMIN]: true })
      .expect(200);
    const required = await withCookie(request(app.getHttpServer()).get("/api/auth/session"));
    expect(required.body.data).toMatchObject({
      status: AUTH_SESSION_STATUS.MFA_REQUIRED,
      setupRequired: true,
    });

    const challenge = await withCookie(
      request(app.getHttpServer()).post("/api/auth/mfa/challenge"),
    ).expect(201);
    cookie = `access_token=${tokenFrom(challenge)}`;
    const setup = await withCookie(request(app.getHttpServer()).post("/api/auth/mfa/setup")).expect(
      201,
    );
    const verified = await withCookie(request(app.getHttpServer()).post("/api/auth/mfa/verify"))
      .send({ token: authenticator.generate(setup.body.data.secret) })
      .expect(201);
    cookie = `access_token=${tokenFrom(verified)}`;

    const session = await withCookie(request(app.getHttpServer()).get("/api/auth/session"));
    expect(session.body.data.status).toBe(AUTH_SESSION_STATUS.AUTHENTICATED);

    // A remounted MFA page must not turn the verified session back into a challenge.
    const repeated = await withCookie(
      request(app.getHttpServer()).post("/api/auth/mfa/challenge"),
    ).expect(201);
    expect(repeated.body.data.status).toBe(AUTH_SESSION_STATUS.AUTHENTICATED);
    await withCookie(request(app.getHttpServer()).get("/api/user/all")).expect(200);
  });

  it("lets users who must change their password complete MFA before the password change", async () => {
    const { user } = await createAccount(false);
    await app.get(SettingsService).updateMFAEnforcedRoles({ [SYSTEM_ROLE_SLUGS.ADMIN]: true });
    await db
      .update(credentials)
      .set({ requiresPasswordChange: true })
      .where(eq(credentials.userId, user.id));
    const login = await auth.login({ email: user.email, password });
    const asPendingUser = (call: request.Test) =>
      call.set("Authorization", `Bearer ${login.accessToken}`);

    const session = await asPendingUser(request(app.getHttpServer()).get("/api/auth/session"));
    expect(session.status).toBe(200);
    expect(session.body.data).toMatchObject({
      status: AUTH_SESSION_STATUS.MFA_REQUIRED,
      setupRequired: true,
    });
    await asPendingUser(request(app.getHttpServer()).post("/api/auth/mfa/challenge")).expect(201);
    const setup = await asPendingUser(
      request(app.getHttpServer()).post("/api/auth/mfa/setup"),
    ).expect(201);
    const verified = await asPendingUser(request(app.getHttpServer()).post("/api/auth/mfa/verify"))
      .send({ token: authenticator.generate(setup.body.data.secret) })
      .expect(201);

    const verifiedCookie = `access_token=${tokenFrom(verified)}`;
    const currentUser = await request(app.getHttpServer())
      .get("/api/auth/current-user")
      .set("Cookie", verifiedCookie)
      .expect(200);
    expect(currentUser.body.data.requiresPasswordChange).toBe(true);
    await request(app.getHttpServer())
      .get("/api/user/password-status")
      .set("Cookie", verifiedCookie)
      .expect(403);
  });

  it("enforces newly enabled role policy on the next request, refresh, and cached WebSocket user", async () => {
    const { user } = await createAccount(false);
    const login = await auth.login({ email: user.email, password });
    await app.get(SettingsService).updateMFAEnforcedRoles({ [SYSTEM_ROLE_SLUGS.ADMIN]: true });
    await request(app.getHttpServer())
      .get("/api/user/all")
      .set("Authorization", `Bearer ${login.accessToken}`)
      .expect(403);
    await expect(auth.refreshTokens(login.refreshToken)).rejects.toThrow();
    const socket = {
      data: { user: { userId: user.id } },
      handshake: { auth: { token: login.accessToken } },
      disconnect: jest.fn(),
    };
    await expect(
      app.get(WsJwtGuard).canActivate({
        switchToWs: () => ({ getClient: () => socket }),
      } as unknown as ExecutionContext),
    ).rejects.toThrow();
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    const status = await request(app.getHttpServer())
      .get("/api/auth/session")
      .set("Authorization", `Bearer ${login.accessToken}`)
      .expect(200);
    expect(status.body.data).toMatchObject({
      status: AUTH_SESSION_STATUS.MFA_REQUIRED,
      setupRequired: true,
    });
    const pending = await request(app.getHttpServer())
      .post("/api/auth/mfa/challenge")
      .set("Authorization", `Bearer ${login.accessToken}`)
      .expect(201);
    expect(app.get(JwtService).decode(tokenFrom(pending))).not.toHaveProperty("permissions");
  });

  it("treats global settings without MFAEnforcedRoles as no enforced roles", async () => {
    const { user } = await createAccount(false);
    await db
      .update(settings)
      .set({ settings: sql`${settings.settings} - 'MFAEnforcedRoles'` })
      .where(isNull(settings.userId));

    const login = await auth.login({ email: user.email, password });

    expect(login.shouldVerifyMFA).toBe(false);
  });

  it("rejects legacy credentials and expired challenges", async () => {
    const { user } = await createAccount();
    const login = await auth.login({ email: user.email, password });
    const payload = app.get(JwtService).decode(login.accessToken) as Record<string, unknown>;
    const secret = app.get(ConfigService).getOrThrow<string>("jwt.secret");
    const expired = await new JwtService().signAsync({ ...payload, exp: 1 }, { secret });
    const legacy = await app
      .get(JwtService)
      .signAsync({ userId: user.id, tenantId: user.tenantId, email: user.email }, { secret });
    for (const token of [expired, legacy]) {
      await request(app.getHttpServer())
        .get("/api/auth/session")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
    }
  });

  it("consumes logout challenges and limits retries across challenges", async () => {
    const { user, secret } = await createAccount();
    const first = await auth.login({ email: user.email, password });
    await request(app.getHttpServer())
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(201);
    await expect(
      sessionService.verifySessionToken(first.accessToken, AUTH_TOKEN_PURPOSE.ACCESS, true),
    ).rejects.toThrow();
    const invalid = String((Number(authenticator.generate(secret)) + 1) % 1000000).padStart(6, "0");
    for (let attempt = 0; attempt < 10; attempt++) {
      const login = await auth.login({ email: user.email, password });
      const claims = await sessionService.verifySessionToken(
        login.accessToken,
        AUTH_TOKEN_PURPOSE.ACCESS,
        true,
      );
      await expect(sessionService.verifyAndConsumeMfaChallenge(claims, invalid)).rejects.toThrow(
        "auth.error.invalidMfaCode",
      );
    }
    const login = await auth.login({ email: user.email, password });
    const claims = await sessionService.verifySessionToken(
      login.accessToken,
      AUTH_TOKEN_PURPOSE.ACCESS,
      true,
    );
    await expect(
      sessionService.verifyAndConsumeMfaChallenge(claims, authenticator.generate(secret)),
    ).rejects.toMatchObject({
      status: 429,
    });
  });

  it("keeps a new challenge open after code reuse and accepts the next code", async () => {
    const { user, secret } = await createAccount();
    const epoch = Math.floor(Date.now() / 30000) * 30000 + 1000;
    const clock = jest.spyOn(Date, "now").mockReturnValue(epoch);
    try {
      const code = authenticator.clone({ epoch }).generate(secret);
      const first = await auth.login({ email: user.email, password });
      const verified = await request(app.getHttpServer())
        .post("/api/auth/mfa/verify")
        .set("Authorization", `Bearer ${first.accessToken}`)
        .send({ token: code })
        .expect(201);
      await request(app.getHttpServer())
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${tokenFrom(verified)}`)
        .expect(201);

      const second = await auth.login({ email: user.email, password });
      const reused = await request(app.getHttpServer())
        .post("/api/auth/mfa/verify")
        .set("Authorization", `Bearer ${second.accessToken}`)
        .send({ token: code })
        .expect(400);
      expect(reused.body.message).toBe("auth.error.mfaCodeAlreadyUsed");
      const session = await request(app.getHttpServer())
        .get("/api/auth/session")
        .set("Authorization", `Bearer ${second.accessToken}`)
        .expect(200);
      expect(session.body.data.status).toBe(AUTH_SESSION_STATUS.MFA_REQUIRED);

      clock.mockReturnValue(epoch + 30000);
      await request(app.getHttpServer())
        .post("/api/auth/mfa/verify")
        .set("Authorization", `Bearer ${second.accessToken}`)
        .send({ token: authenticator.clone({ epoch: epoch + 30000 }).generate(secret) })
        .expect(201);
    } finally {
      clock.mockRestore();
    }
  });

  it("allows exactly one concurrent verification and rejects TOTP reuse on another challenge", async () => {
    const { user, secret } = await createAccount();
    const logins = await Promise.all([
      auth.login({ email: user.email, password }),
      auth.login({ email: user.email, password }),
    ]);
    const claims = await Promise.all(
      logins.map(({ accessToken }) =>
        sessionService.verifySessionToken(accessToken, AUTH_TOKEN_PURPOSE.ACCESS, true),
      ),
    );
    const token = authenticator.generate(secret);
    const results = await Promise.allSettled(
      claims.map((claim) => sessionService.verifyAndConsumeMfaChallenge(claim, token)),
    );
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  });
});
