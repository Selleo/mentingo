import { SUPPORTED_LANGUAGES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq } from "drizzle-orm";

import { AuthService } from "src/auth/auth.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { magicLinkTokens, resetTokens, tenants, users } from "src/storage/schema";
import { UserImportRepository } from "src/user/repositories/user-import.repository";
import { UserService } from "src/user/user.service";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

describe("Tenant-scoped user emails (e2e)", () => {
  let app: INestApplication;
  let authService: AuthService;
  let userService: UserService;
  let userImportRepository: UserImportRepository;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let defaultTenantId: UUIDType;
  let tenantRunner: TenantDbRunnerService;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;

  const testPassword = "Password123@";

  beforeAll(async () => {
    const testApp = await createE2ETest({ useDbProxy: true });
    app = testApp.app;
    defaultTenantId = testApp.defaultTenantId;
    authService = app.get(AuthService);
    userService = app.get(UserService);
    userImportRepository = app.get(UserImportRepository);
    tenantRunner = app.get(TenantDbRunnerService);
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
  });

  beforeEach(async () => {
    await tenantRunner.runWithTenant(defaultTenantId, () =>
      settingsFactory.create({ userId: null }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const createTenant = async () => {
    const host = `https://tenant-${crypto.randomUUID()}.local`;
    const [tenant] = await baseDb
      .insert(tenants)
      .values({ name: "Duplicate Email Tenant", host })
      .returning({ id: tenants.id });

    await tenantRunner.runWithTenant(tenant.id, () => settingsFactory.create({ userId: null }));

    return tenant.id;
  };

  const createUserForTenant = (
    tenantId: UUIDType,
    email: string,
    password?: string,
    roleSlug = SYSTEM_ROLE_SLUGS.STUDENT,
  ) =>
    tenantRunner.runWithTenant(tenantId, () => {
      const factory = password ? userFactory.withCredentials({ password }) : userFactory;

      return factory.associations({ roleSlug }).withUserSettings(db).create({ email, tenantId });
    });

  it("registers and authenticates same-email users per tenant", async () => {
    const secondTenantId = await createTenant();
    const email = `multi-tenant-auth-${crypto.randomUUID()}@example.com`;
    const payload = {
      email,
      password: testPassword,
      firstName: "Multi",
      lastName: "Tenant",
      language: SUPPORTED_LANGUAGES.EN,
    };

    await tenantRunner.runWithTenant(defaultTenantId, () => authService.register(payload));
    await tenantRunner.runWithTenant(secondTenantId, () =>
      authService.register({ ...payload, password: "OtherPassword123@" }),
    );
    await expect(
      tenantRunner.runWithTenant(defaultTenantId, () => authService.register(payload)),
    ).rejects.toThrow("registerView.toast.userAlreadyExists");

    const defaultTenantUser = await tenantRunner.runWithTenant(defaultTenantId, () =>
      authService.validateUser(email, testPassword),
    );
    const secondTenantUser = await tenantRunner.runWithTenant(secondTenantId, () =>
      authService.validateUser(email, "OtherPassword123@"),
    );

    expect(defaultTenantUser.email).toBe(email);
    expect(secondTenantUser.email).toBe(email);
    expect(defaultTenantUser.id).not.toBe(secondTenantUser.id);
  });

  it("creates reset and magic-link tokens for the current tenant user", async () => {
    const secondTenantId = await createTenant();
    const email = `multi-tenant-token-${crypto.randomUUID()}@example.com`;
    const defaultTenantUser = await createUserForTenant(defaultTenantId, email);
    const secondTenantUser = await createUserForTenant(secondTenantId, email);

    await tenantRunner.runWithTenant(secondTenantId, () => authService.forgotPassword(email));
    await tenantRunner.runWithTenant(secondTenantId, () => authService.createMagicLink(email));

    const defaultResetTokens = await baseDb
      .select()
      .from(resetTokens)
      .where(eq(resetTokens.userId, defaultTenantUser.id));
    const secondResetTokens = await baseDb
      .select()
      .from(resetTokens)
      .where(eq(resetTokens.userId, secondTenantUser.id));
    const defaultMagicTokens = await baseDb
      .select()
      .from(magicLinkTokens)
      .where(eq(magicLinkTokens.userId, defaultTenantUser.id));
    const secondMagicTokens = await baseDb
      .select()
      .from(magicLinkTokens)
      .where(eq(magicLinkTokens.userId, secondTenantUser.id));

    expect(defaultResetTokens).toHaveLength(0);
    expect(secondResetTokens).toHaveLength(1);
    expect(defaultMagicTokens).toHaveLength(0);
    expect(secondMagicTokens).toHaveLength(1);
  });

  it("creates users and import lookup results using tenant-scoped email uniqueness", async () => {
    const secondTenantId = await createTenant();
    const createEmail = `multi-tenant-create-${crypto.randomUUID()}@example.com`;
    const importEmail = `multi-tenant-import-${crypto.randomUUID()}@example.com`;
    await createUserForTenant(defaultTenantId, createEmail);
    await createUserForTenant(defaultTenantId, importEmail);

    const createdUser = await tenantRunner.runWithTenant(secondTenantId, () =>
      userService.createUser({
        email: createEmail,
        firstName: "Tenant",
        lastName: "User",
        roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
        language: SUPPORTED_LANGUAGES.EN,
      }),
    );
    await expect(
      tenantRunner.runWithTenant(secondTenantId, () =>
        userService.createUser({
          email: createEmail,
          firstName: "Duplicate",
          lastName: "User",
          roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
          language: SUPPORTED_LANGUAGES.EN,
        }),
      ),
    ).rejects.toThrow("registerView.toast.userAlreadyExists");

    const importMatches = await tenantRunner.runWithTenant(secondTenantId, () =>
      userImportRepository.findExistingUsersByEmails([importEmail]),
    );
    const createdUsers = await baseDb
      .select({ id: users.id, tenantId: users.tenantId })
      .from(users)
      .where(eq(users.email, createEmail));

    expect(createdUser.email).toBe(createEmail);
    expect(importMatches).toEqual([]);
    expect(createdUsers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: createdUser.id, tenantId: secondTenantId }),
      ]),
    );
  });
});
