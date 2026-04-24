import { randomUUID } from "node:crypto";

import { expect, mergeTests, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { createFixtureFactories } from "../factories";
import { fillCreateNewPasswordFormFlow } from "../flows/auth/fill-create-new-password-form.flow";
import { submitCreateNewPasswordFormFlow } from "../flows/auth/submit-create-new-password-form.flow";
import { createFixtureApiClient } from "../utils/api-client";
import {
  AUTH_ACCOUNT_TEMPLATE,
  getAuthEmail,
  getWorkerAuthStatePath,
  getWorkerTenantAuthStatePath,
} from "../utils/auth-email";
import { extractLinkFromMailhogMessage, waitForMailhogMessage } from "../utils/mailhog";

import { login } from "./auth.actions";
import { cleanupFixture } from "./cleanup.fixture";
import { factoryFixture } from "./factory.fixture";
import { pageFixture } from "./page.fixture";

import type { PageHandle } from "./types";
import type { FixtureFactories } from "../factories";
import type { TenantFactoryCreateInput, TenantFactoryRecord } from "../factories/tenant.factory";
import type { UserFactoryRecord } from "../factories/user.factory";
import type { FixtureApiClient } from "../utils/api-client";
import type { UserRole } from "~/config/userRoles";

type WithAuthPage = (role: UserRole, run: (handle: PageHandle) => Promise<void>) => Promise<void>;
type CreateIsolatedWorkspace = (options?: {
  role?: UserRole;
  tenant?: TenantFactoryCreateInput;
}) => Promise<IsolatedWorkspaceHandle>;
type WithIsolatedWorkspace = (
  role: UserRole,
  run: (workspace: IsolatedWorkspaceHandle) => Promise<void>,
  tenant?: TenantFactoryCreateInput,
) => Promise<void>;

export type IsolatedWorkspaceHandle = {
  apiClient: FixtureApiClient;
  context: BrowserContext;
  factories: FixtureFactories;
  origin: string;
  page: Page;
  tenant: TenantFactoryRecord;
  createTenantUserWithPasswordAndRole: (options: {
    email?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    role: UserRole;
  }) => Promise<TenantUserHandle>;
};

export type TenantUserHandle = {
  apiClient: FixtureApiClient;
  context: BrowserContext;
  page: Page;
  user: UserFactoryRecord;
};

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

const createIsolatedTenantInput = (
  baseURL: string,
  input?: TenantFactoryCreateInput,
): TenantFactoryCreateInput => {
  if (input?.host) {
    return input;
  }

  const slug = randomUUID().slice(0, 8);
  const protocol = new URL(baseURL).protocol;

  return {
    ...input,
    name: input?.name ?? `Isolated Workspace ${slug}`,
    host: `${protocol}//${"e2e-tenant"}-${slug}.lms.localhost`,
    adminEmail: input?.adminEmail ?? `e2e-admin-${slug}@example.com`,
    adminFirstName: input?.adminFirstName ?? "Tenant",
    adminLastName: input?.adminLastName ?? "Admin",
    adminLanguage: input?.adminLanguage ?? "en",
    status: input?.status ?? "active",
  };
};

const addWorkspaceInitScript = async (context: BrowserContext, origin: string) => {
  await context.addInitScript(
    ({ apiUrl, appUrl }: { apiUrl: string; appUrl: string }) => {
      const targetWindow = window as Window & { ENV?: Record<string, string> };
      targetWindow.ENV = {
        ...(targetWindow.ENV ?? {}),
        VITE_API_URL: apiUrl,
        VITE_APP_URL: appUrl,
      };
    },
    { apiUrl: origin, appUrl: origin },
  );
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
    createIsolatedWorkspace: CreateIsolatedWorkspace;
    withIsolatedWorkerPage: WithIsolatedWorkspace;
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
        await apiClient.syncFromContext(adminContext, origin);

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

        await apiClient.syncFromContext(handle.context, origin);

        await run(handle);
      });
    });
  },
  withWorkerPage: async ({ _workerAuthReady, apiClient, baseURL, withWorkerPage }, use) => {
    void _workerAuthReady;
    await use(async (role, run) => {
      await withWorkerPage(role, async (handle) => {
        const origin = new URL(baseURL!).origin;

        await apiClient.syncFromContext(handle.context, origin);

        await run(handle);
      });
    });
  },
  createIsolatedWorkspace: async ({ browser, baseURL, cleanup }, use, workerInfo) => {
    await use(async (options = {}) => {
      const origin = new URL(baseURL!).origin;
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      const tenantContext = await browser.newContext();
      const tenantPage = await tenantContext.newPage();
      const apiClient = createFixtureApiClient();
      const cleanupAdminApiClient = createFixtureApiClient();

      cleanup.add(async () => {
        await tenantContext.close();
        await adminContext.close();
      });

      await addWorkspaceInitScript(adminContext, origin);
      await addWorkspaceInitScript(tenantContext, origin);

      await adminPage.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
      await apiClient.syncFromContext(adminContext, origin);
      await cleanupAdminApiClient.syncFromContext(adminContext, origin);

      const tenantFactories = createFixtureFactories(apiClient);
      const cleanupTenantFactories = createFixtureFactories(cleanupAdminApiClient);
      const tenantFactory = tenantFactories.createTenantFactory();
      const cleanupTenantFactory = cleanupTenantFactories.createTenantFactory();
      const tenantInput = createIsolatedTenantInput(baseURL!, options.tenant);
      const tenant = await tenantFactory.create(tenantInput);

      cleanup.add(async () => {
        await cleanupTenantFactory.deactivate(tenant.id);
      });

      const workspaceOrigin = new URL(tenant.host).origin;
      const tenantAdminEmail = tenantInput.adminEmail!;
      const tenantAdminPassword = ACCOUNT_PASSWORD;

      const invitationMessage = await waitForMailhogMessage({
        recipient: tenantAdminEmail,
        subjectIncludes: "You're invited to the platform!",
      });
      const inviteLink = extractLinkFromMailhogMessage(
        invitationMessage,
        "/auth/create-new-password",
      );
      const inviteUrl = new URL(inviteLink, workspaceOrigin).toString();

      await tenantPage.goto(inviteUrl);
      await expect(tenantPage).toHaveURL(/\/auth\/create-new-password\?/);
      await expect(tenantPage.getByTestId("create-new-password-page")).toBeVisible();

      await fillCreateNewPasswordFormFlow(tenantPage, { newPassword: tenantAdminPassword });
      await submitCreateNewPasswordFormFlow(tenantPage);
      await expect(tenantPage).toHaveURL(/\/auth\/login(?:\?.*)?$/);

      await apiClient.syncFromContext(tenantContext, workspaceOrigin);

      const createTenantUserWithPasswordAndRole = async (input: {
        email?: string;
        firstName?: string;
        lastName?: string;
        password?: string;
        role: UserRole;
      }): Promise<TenantUserHandle> => {
        const email = input.email ?? `isolated-user-${randomUUID().slice(0, 8)}@example.com`;
        const password = input.password ?? ACCOUNT_PASSWORD;
        const registrationClient = createFixtureApiClient();
        registrationClient.syncTenantOrigin(workspaceOrigin);
        const authStatePath = getWorkerTenantAuthStatePath(
          workerInfo.project.name,
          workerInfo.workerIndex,
          tenant.id,
        );

        const userRegisterResponse = await registrationClient.api.authControllerRegister({
          email,
          firstName: input.firstName ?? "Isolated",
          lastName: input.lastName ?? "User",
          password,
          language: "en",
        });

        const userFactory = tenantFactories.createUserFactory();
        await userFactory.update(userRegisterResponse.data.data.id, {
          roleSlugs: [input.role],
        });

        const userContext = await browser.newContext();
        const userPage = await userContext.newPage();
        const userApiClient = createFixtureApiClient();

        cleanup.add(async () => {
          await userContext.close();
        });

        await addWorkspaceInitScript(userContext, workspaceOrigin);
        await login(userPage, email, password, { origin: workspaceOrigin });
        await userApiClient.syncFromContext(userContext, workspaceOrigin);
        await userContext.storageState({ path: authStatePath });

        return {
          apiClient: userApiClient,
          context: userContext,
          page: userPage,
          user: await userFactory.getById(userRegisterResponse.data.data.id),
        };
      };

      return {
        apiClient,
        context: tenantContext,
        factories: tenantFactories,
        origin: workspaceOrigin,
        page: tenantPage,
        tenant,
        createTenantUserWithPasswordAndRole,
      };
    });
  },
  withIsolatedWorkerPage: async ({ createIsolatedWorkspace }, use) => {
    await use(async (role, run, tenant) => {
      const workspace = await createIsolatedWorkspace({ role, tenant });
      await run(workspace);
    });
  },
});

export { expect };
