import { LOGIN_METHOD_ERROR_KEYS, LOGIN_METHODS, SUPPORTED_LANGUAGES } from "@repo/shared";
import { isNull } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { EnvService } from "src/env/services/env.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { settings } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSecretFactory } from "../../../test/factory/secret.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import {
  ACCEPTED_LOGIN_METHOD_UPDATES,
  ADMIN_PASSWORD,
  AUTH_REQUEST_KINDS,
  LOGIN_METHOD_FLAGS,
  NO_OAUTH_PROVIDER_SECRETS,
  REJECTED_LOGIN_METHOD_UPDATES,
  REQUESTS_BLOCKED_BY_DISABLED_LOGIN_METHOD,
} from "./login-methods.scenarios";

import type { AuthRequestKind } from "./login-methods.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { GlobalSettings } from "src/common/types";

describe("Organization login methods (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let inTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let secretFactory: ReturnType<typeof createSecretFactory>;

  const storeSecrets = (secrets: Record<string, string>) =>
    inTenant(() =>
      Promise.all(
        Object.entries(secrets).map(([name, value]) => secretFactory.create({ name, value })),
      ),
    );

  const enforceSSO = () =>
    inTenant(async () => {
      const [globalSettings] = await db
        .select({ settings: settings.settings })
        .from(settings)
        .where(isNull(settings.userId));

      await db
        .update(settings)
        .set({ settings: { ...(globalSettings.settings as GlobalSettings), enforceSSO: true } })
        .where(isNull(settings.userId));
    });

  const arrangeAdminCookie = async () => {
    const admin = await inTenant(() =>
      userFactory.withCredentials({ password: ADMIN_PASSWORD }).withAdminSettings(db).create(),
    );

    return cookieFor(admin, app);
  };

  const getPublicLoginMethods = async () =>
    (await request(app.getHttpServer()).get("/api/env/login-methods").expect(200)).body.data;

  const sendAuthRequest = (kind: AuthRequestKind) => {
    const server = request(app.getHttpServer());

    return match(kind)
      .with(AUTH_REQUEST_KINDS.REGISTER, () =>
        server.post("/api/auth/register").send({
          email: "new-user@example.com",
          firstName: "New",
          lastName: "User",
          password: ADMIN_PASSWORD,
          language: SUPPORTED_LANGUAGES.EN,
        }),
      )
      .with(AUTH_REQUEST_KINDS.PASSWORD_LOGIN, () =>
        server
          .post("/api/auth/login")
          .send({ email: "user@example.com", password: ADMIN_PASSWORD }),
      )
      .with(AUTH_REQUEST_KINDS.FORGOT_PASSWORD, () =>
        server.post("/api/auth/forgot-password").send({ email: "user@example.com" }),
      )
      .with(AUTH_REQUEST_KINDS.CREATE_PASSWORD, () =>
        server.post("/api/auth/create-password").send({
          createToken: "issued-create-token",
          password: ADMIN_PASSWORD,
          language: SUPPORTED_LANGUAGES.EN,
        }),
      )
      .with(AUTH_REQUEST_KINDS.RESET_PASSWORD, () =>
        server
          .post("/api/auth/reset-password")
          .send({ resetToken: "issued-reset-token", newPassword: ADMIN_PASSWORD }),
      )
      .with(AUTH_REQUEST_KINDS.CREATE_MAGIC_LINK, () =>
        server.post("/api/auth/magic-link/create").send({ email: "user@example.com" }),
      )
      .with(AUTH_REQUEST_KINDS.VERIFY_MAGIC_LINK, () =>
        server.get("/api/auth/magic-link/verify").query({ token: "issued-magic-link-token" }),
      )
      .exhaustive();
  };

  beforeAll(async () => {
    const {
      app: testApp,
      runAsTenant,
      defaultTenantId,
    } = await createE2ETest({
      useDbProxy: true,
    });
    app = testApp;
    inTenant = (fn) => runAsTenant(defaultTenantId, fn);
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    secretFactory = createSecretFactory(app.get(EnvService));
  });

  beforeEach(async () => {
    await truncateTables(baseDb, ["secrets", "settings"]);
    await inTenant(() => settingsFactory.create({ userId: null }));
    await storeSecrets(NO_OAUTH_PROVIDER_SECRETS);
  });

  afterEach(async () => {
    await truncateTables(baseDb, ["secrets", "settings"]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/env/login-methods", () => {
    it("enables password and magic link by default and never exposes provider secrets", async () => {
      await storeSecrets({ GOOGLE_CLIENT_SECRET: "private-value" });

      const loginMethods = await getPublicLoginMethods();

      expect(loginMethods).toEqual({
        google: false,
        microsoft: false,
        slack: false,
        magicLink: true,
        password: true,
      });
      expect(JSON.stringify(loginMethods)).not.toContain("private-value");
    });
  });

  describe("GET /api/env/login-methods/setup", () => {
    it("reports missing provider credential names without their stored values", async () => {
      await storeSecrets({ MICROSOFT_CLIENT_ID: "existing-id" });
      const cookie = await arrangeAdminCookie();

      const response = await request(app.getHttpServer())
        .get("/api/env/login-methods/setup")
        .set("Cookie", cookie)
        .expect(200);

      expect(response.body.data.missingCredentials).toEqual({
        google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
        microsoft: ["MICROSOFT_CLIENT_SECRET"],
        slack: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"],
      });
      expect(JSON.stringify(response.body)).not.toContain("existing-id");
    });

    it("is forbidden for users without env management permission", async () => {
      const student = await inTenant(() =>
        userFactory.withCredentials({ password: ADMIN_PASSWORD }).withUserSettings(db).create(),
      );
      const cookie = await cookieFor(student, app);

      await request(app.getHttpServer())
        .get("/api/env/login-methods/setup")
        .set("Cookie", cookie)
        .expect(403);
      await request(app.getHttpServer())
        .post("/api/env/login-methods")
        .set("Cookie", cookie)
        .send({ method: LOGIN_METHODS.PASSWORD, enabled: false })
        .expect(403);
    });
  });

  describe("POST /api/env/login-methods", () => {
    it.each(REJECTED_LOGIN_METHOD_UPDATES)(
      "rejects $title without saving anything",
      async ({ storedSecrets, enforceSSO: isSSOEnforced, update, expectedError }) => {
        await storeSecrets(storedSecrets);
        const cookie = await arrangeAdminCookie();
        if (isSSOEnforced) await enforceSSO();
        const loginMethodsBefore = await getPublicLoginMethods();

        const response = await request(app.getHttpServer())
          .post("/api/env/login-methods")
          .set("Cookie", cookie)
          .send(update)
          .expect(400);

        expect(response.body.message).toBe(expectedError);
        expect(await getPublicLoginMethods()).toEqual(loginMethodsBefore);
      },
    );

    it.each(ACCEPTED_LOGIN_METHOD_UPDATES)(
      "accepts $title",
      async ({ storedSecrets, update, expectedMethods, expectedPublicSSOFlags }) => {
        await storeSecrets(storedSecrets);
        const cookie = await arrangeAdminCookie();

        const response = await request(app.getHttpServer())
          .post("/api/env/login-methods")
          .set("Cookie", cookie)
          .send(update)
          .expect(201);

        expect(response.body.data.methods).toMatchObject(expectedMethods);
        expect(await getPublicLoginMethods()).toMatchObject(expectedMethods);

        const ssoFlags = await request(app.getHttpServer())
          .get("/api/env/frontend/sso")
          .expect(200);
        expect(ssoFlags.body.data).toMatchObject(expectedPublicSSOFlags);
      },
    );

    it("waits for the organization settings lock so concurrent updates cannot lock everyone out", async () => {
      const cookie = await arrangeAdminCookie();
      let releaseSettingsLock!: () => void;
      let markSettingsLocked!: () => void;
      const settingsLockReleased = new Promise<void>((resolve) => (releaseSettingsLock = resolve));
      const settingsLocked = new Promise<void>((resolve) => (markSettingsLocked = resolve));

      const concurrentSettingsLock = baseDb.transaction(async (transaction) => {
        await transaction.select().from(settings).where(isNull(settings.userId)).for("update");
        markSettingsLocked();
        await settingsLockReleased;
      });
      await settingsLocked;

      let isUpdateFinished = false;
      const update = request(app.getHttpServer())
        .post("/api/env/login-methods")
        .set("Cookie", cookie)
        .send({ method: LOGIN_METHODS.PASSWORD, enabled: false })
        .then((response) => {
          isUpdateFinished = true;
          return response;
        });

      try {
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(isUpdateFinished).toBe(false);
      } finally {
        releaseSettingsLock();
        await concurrentSettingsLock;
      }

      expect((await update).status).toBe(201);
    });
  });

  describe("POST /api/env/bulk", () => {
    it.each(LOGIN_METHOD_FLAGS)(
      "refuses to write %s around the last-login-method check",
      async (loginMethodFlag) => {
        const cookie = await arrangeAdminCookie();
        const loginMethodsBefore = await getPublicLoginMethods();

        await request(app.getHttpServer())
          .post("/api/env/bulk")
          .set("Cookie", cookie)
          .send([{ name: loginMethodFlag, value: "false" }])
          .expect(400);

        expect(await getPublicLoginMethods()).toEqual(loginMethodsBefore);
      },
    );
  });

  describe("GET /api/env/config/setup", () => {
    it("treats a provider with both login credentials as configured regardless of calendar keys", async () => {
      await storeSecrets({
        MICROSOFT_CLIENT_ID: "microsoft-id",
        MICROSOFT_CLIENT_SECRET: "microsoft-secret",
      });
      const cookie = await arrangeAdminCookie();

      const response = await request(app.getHttpServer())
        .get("/api/env/config/setup")
        .set("Cookie", cookie)
        .expect(200);
      const { fullyConfigured, partiallyConfigured, notConfigured } = response.body.data;

      expect(fullyConfigured).toContain("microsoft_authorization");
      expect(notConfigured).toEqual(
        expect.arrayContaining([
          {
            service: "google_authorization",
            missingKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
          },
        ]),
      );
      expect(
        [...partiallyConfigured, ...notConfigured].flatMap(({ missingKeys }) => missingKeys),
      ).not.toEqual(expect.arrayContaining([expect.stringMatching(/_OAUTH_ENABLED$/)]));
    });
  });

  describe("auth flows of a disabled login method", () => {
    it.each(REQUESTS_BLOCKED_BY_DISABLED_LOGIN_METHOD)(
      "rejects $request when $disabledFlag is false",
      async ({ request: authRequestKind, disabledFlag }) => {
        await storeSecrets({ [disabledFlag]: "false" });

        const response = await sendAuthRequest(authRequestKind).expect(401);

        expect(response.body.message).toBe(LOGIN_METHOD_ERROR_KEYS.DISABLED);
      },
    );
  });
});
