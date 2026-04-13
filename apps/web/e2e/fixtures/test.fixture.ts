import { expect, mergeTests, type Browser } from "@playwright/test";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { createFixtureApiClient } from "../utils/api-client";
import { AUTH_ACCOUNT_TEMPLATE, getAuthEmail, getWorkerAuthStatePath } from "../utils/auth-email";

import { login } from "./auth.actions";
import { cleanupFixture } from "./cleanup.fixture";
import { factoryFixture } from "./factory.fixture";
import { pageFixture } from "./page.fixture";

import type { PageHandle } from "./types";
import type { UserRole } from "~/config/userRoles";

type WithAuthPage = (role: UserRole, run: (handle: PageHandle) => Promise<void>) => Promise<void>;

const AUTH_ROLES = [
  SYSTEM_ROLE_SLUGS.STUDENT,
  SYSTEM_ROLE_SLUGS.ADMIN,
  SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
] as const satisfies readonly UserRole[];

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "password";
const ACCOUNT_PASSWORD = "Password123@";

const roleLabelBySlug: Record<UserRole, string> = {
  [SYSTEM_ROLE_SLUGS.STUDENT]: "Student",
  [SYSTEM_ROLE_SLUGS.ADMIN]: "Admin",
  [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]: "Content Creator",
};

const getSeedName = (role: UserRole, workerIndex: number) => {
  return {
    firstName: `Worker ${workerIndex} ${roleLabelBySlug[role]}`,
    lastName: "E2E",
  };
};

const findUserByEmail = async (
  apiClient: ReturnType<typeof createFixtureApiClient>,
  email: string,
) => {
  const response = await apiClient.api.userControllerGetUsers({
    keyword: email,
    perPage: 100,
    sort: "email",
  });

  return response.data.data.find((user) => user.email === email) ?? null;
};

const ensureWorkerUserAccount = async (
  apiClient: ReturnType<typeof createFixtureApiClient>,
  projectName: string,
  workerIndex: number,
  role: UserRole,
) => {
  const email = getAuthEmail(AUTH_ACCOUNT_TEMPLATE.WORKER, role, projectName, workerIndex);
  let user = await findUserByEmail(apiClient, email);

  if (!user) {
    const { firstName, lastName } = getSeedName(role, workerIndex);

    await apiClient.api.authControllerRegister({
      email,
      firstName,
      lastName,
      password: ACCOUNT_PASSWORD,
      language: "en",
    });

    user = await findUserByEmail(apiClient, email);
  }

  if (!user) {
    throw new Error(`Failed to create or find worker auth user for ${email}`);
  }

  await apiClient.api.userControllerAdminUpdateUser({ id: user.id }, { roleSlugs: [role] });

  return { email, path: getWorkerAuthStatePath(projectName, workerIndex, role) };
};

const writeWorkerAuthState = async (browser: Browser, email: string, path: string) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await login(page, email, ACCOUNT_PASSWORD);
    await context.storageState({ path });
  } finally {
    await context.close();
  }
};

const mergedFixture = mergeTests(pageFixture, factoryFixture, cleanupFixture);

export const test = mergedFixture.extend<
  {
    withReadonlyPage: WithAuthPage;
    withWorkerPage: WithAuthPage;
  },
  {
    _workerAuthReady: void;
  }
>({
  _workerAuthReady: [
    async ({ browser }, use, workerInfo) => {
      const apiClient = createFixtureApiClient();
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      const workerAuthStates: { email: string; path: string }[] = [];

      try {
        await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);

        const origin = new URL(adminPage.url()).origin;
        apiClient.syncTenantOrigin(origin);
        apiClient.syncCookies(await adminContext.cookies(origin));

        for (const role of AUTH_ROLES) {
          workerAuthStates.push(
            await ensureWorkerUserAccount(
              apiClient,
              workerInfo.project.name,
              workerInfo.workerIndex,
              role,
            ),
          );
        }
      } finally {
        apiClient.clearCookies();
        await adminContext.close();
      }

      for (const { email, path } of workerAuthStates) {
        await writeWorkerAuthState(browser, email, path);
      }

      await use();
    },
    { scope: "worker", timeout: 90 * 1000 },
  ],
  withReadonlyPage: async ({ apiClient, baseURL, withReadonlyPage }, use) => {
    await use(async (role, run) => {
      await withReadonlyPage(role, async (handle) => {
        const origin = new URL(baseURL!).origin;

        apiClient.syncTenantOrigin(origin);
        apiClient.syncCookies(await handle.context.cookies(origin));

        await run(handle);
      });
    });
  },
  withWorkerPage: async ({ _workerAuthReady, apiClient, baseURL, withWorkerPage }, use) => {
    void _workerAuthReady;
    await use(async (role, run) => {
      await withWorkerPage(role, async (handle) => {
        const origin = new URL(baseURL!).origin;

        apiClient.syncTenantOrigin(origin);
        apiClient.syncCookies(await handle.context.cookies(origin));

        await run(handle);
      });
    });
  },
});

export { expect };
