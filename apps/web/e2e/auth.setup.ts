import { test as setup } from "@playwright/test";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { login } from "./fixtures/auth.actions";
import { createFixtureApiClient } from "./utils/api-client";
import { AUTH_ACCOUNT_TEMPLATE, getAuthEmail, getReadonlyAuthStatePath } from "./utils/auth-email";

import type { Browser } from "@playwright/test";

const AUTH_ROLES = [
  SYSTEM_ROLE_SLUGS.STUDENT,
  SYSTEM_ROLE_SLUGS.ADMIN,
  SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
] as const;
type AuthRole = (typeof AUTH_ROLES)[number];
type AuthTemplate = (typeof AUTH_ACCOUNT_TEMPLATE)[keyof typeof AUTH_ACCOUNT_TEMPLATE];

const ADMIN_PASSWORD = "password";
const ACCOUNT_PASSWORD = "Password123@";
const ADMIN_EMAIL = "admin@example.com";
const apiClient = createFixtureApiClient();

const roleLabelBySlug: Record<AuthRole, string> = {
  [SYSTEM_ROLE_SLUGS.STUDENT]: "Student",
  [SYSTEM_ROLE_SLUGS.ADMIN]: "Admin",
  [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]: "Content Creator",
};

const getSeedName = (template: AuthTemplate, role: AuthRole, workerIndex?: number) => {
  const prefix =
    template === AUTH_ACCOUNT_TEMPLATE.READONLY
      ? "Readonly"
      : `Worker ${typeof workerIndex === "number" ? workerIndex : 0}`;

  return {
    firstName: `${prefix} ${roleLabelBySlug[role]}`,
    lastName: "E2E",
  };
};

// TODO: Create backend endpoint for this
const findUserByEmail = async (email: string) => {
  const response = await apiClient.api.userControllerGetUsers({
    keyword: email,
    perPage: 100,
    sort: "email",
  });

  return response.data.data.find((user) => user.email === email) ?? null;
};

const ensureUserAccount = async (
  email: string,
  role: AuthRole,
  template: AuthTemplate,
  workerIndex?: number,
) => {
  let user = await findUserByEmail(email);

  if (!user) {
    const { firstName, lastName } = getSeedName(template, role, workerIndex);

    await apiClient.api.authControllerRegister({
      email,
      firstName,
      lastName,
      password: ACCOUNT_PASSWORD,
      language: "en",
    });

    user = await findUserByEmail(email);
  }

  if (!user) {
    throw new Error(`Failed to create or find auth user for ${email}`);
  }

  await apiClient.api.userControllerAdminUpdateUser({ id: user.id }, { roleSlugs: [role] });

  return user;
};

const READONLY_AUTH_STATES = AUTH_ROLES.map((role) => ({
  email: getAuthEmail(AUTH_ACCOUNT_TEMPLATE.READONLY, role),
  path: getReadonlyAuthStatePath(role),
}));

const writeAuthState = async (browser: Browser, email: string, path: string) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await login(page, email, ACCOUNT_PASSWORD);
    await context.storageState({ path });
  } finally {
    await context.close();
  }
};

setup("authenticate", async ({ browser }) => {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  try {
    await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
    apiClient.syncTenantOrigin(new URL(adminPage.url()).origin);
    apiClient.syncCookies(await adminContext.cookies());

    for (const role of AUTH_ROLES) {
      await ensureUserAccount(
        getAuthEmail(AUTH_ACCOUNT_TEMPLATE.READONLY, role),
        role,
        AUTH_ACCOUNT_TEMPLATE.READONLY,
      );
    }
  } finally {
    apiClient.clearCookies();
    await adminContext.close();
  }

  // TODO: Implement the tags like @smoke, @core etc based on docs
  for (const { email, path } of READONLY_AUTH_STATES) {
    await writeAuthState(browser, email, path);
  }
});
