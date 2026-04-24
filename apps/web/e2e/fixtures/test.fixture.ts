import { randomUUID } from "node:crypto";

import { expect, mergeTests, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { createFixtureFactories } from "../factories";
import { createFixtureApiClient } from "../utils/api-client";
import {
  AUTH_ACCOUNT_TEMPLATE,
  getAuthEmail,
  getWorkerAuthStatePath,
  getWorkerTenantAuthEmail,
  getWorkerTenantAuthStatePath,
} from "../utils/auth-email";
import { extractLinkFromMailhogMessage, waitForMailhogMessage } from "../utils/mailhog";
import { markAllOnboardingComplete } from "../utils/onboarding";

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

type WithAuthPageOptions = {
  root?: boolean;
};
type WithAuthPage = (
  role: UserRole,
  run: (handle: PageHandle) => Promise<void>,
  options?: WithAuthPageOptions,
) => Promise<void>;
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

type WorkerTenantWorkspace = {
  authStatePaths: Record<UserRole, string>;
  origin: string;
  tenant: TenantFactoryRecord;
};

const AUTH_ROLES = [
  SYSTEM_ROLE_SLUGS.STUDENT,
  SYSTEM_ROLE_SLUGS.ADMIN,
  SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
] as const satisfies readonly UserRole[];

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "password";
const ACCOUNT_PASSWORD = "Password123@";
const DEFAULT_BASE_URL = process.env.CI
  ? "http://localhost:5173"
  : process.env.VITE_APP_URL || "https://tenant1.lms.localhost";

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
  const baseUrl = new URL(baseURL);
  const port = baseUrl.port ? `:${baseUrl.port}` : "";

  return {
    ...input,
    name: input?.name ?? `Isolated Workspace ${slug}`,
    host: `${baseUrl.protocol}//${"e2e-tenant"}-${slug}.lms.localhost${port}`,
    adminEmail: input?.adminEmail ?? `e2e-admin-${slug}@example.com`,
    adminFirstName: input?.adminFirstName ?? "Tenant",
    adminLastName: input?.adminLastName ?? "Admin",
    adminLanguage: input?.adminLanguage ?? "en",
    status: input?.status ?? "active",
  };
};

const completeCreatePasswordFromInvite = async (
  origin: string,
  inviteLink: string,
  password: string,
) => {
  const createToken = new URL(inviteLink, origin).searchParams.get("createToken");

  if (!createToken) {
    throw new Error("Could not find createToken in tenant invitation link");
  }

  const apiClient = createFixtureApiClient();
  apiClient.syncTenantOrigin(origin);

  try {
    await apiClient.api.authControllerCreatePassword({
      createToken,
      password,
      language: "en",
    });
  } finally {
    apiClient.clearCookies();
  }
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

const writeWorkerAuthState = async (
  browser: Browser,
  email: string,
  path: string,
  origin?: string,
) => {
  const context = await browser.newContext(origin ? { baseURL: origin } : undefined);
  const apiClient = createFixtureApiClient();

  try {
    if (origin) await addWorkspaceInitScript(context, origin);

    const page = await context.newPage();
    await login(page, email, ACCOUNT_PASSWORD, origin ? { origin } : undefined);
    await apiClient.syncFromContext(context, origin ?? new URL(page.url()).origin);
    await markAllOnboardingComplete(apiClient);
    await context.storageState({ path });
  } finally {
    apiClient.clearCookies();
    await context.close();
  }
};

const createTenantRoleUserAuthState = async (options: {
  browser: Browser;
  factories: FixtureFactories;
  origin: string;
  password: string;
  projectName: string;
  role: UserRole;
  tenantId: string;
  workerIndex: number;
}) => {
  const email = getWorkerTenantAuthEmail(
    options.projectName,
    options.workerIndex,
    options.tenantId,
    options.role,
  );
  const registrationClient = createFixtureApiClient();
  registrationClient.syncTenantOrigin(options.origin);

  const userRegisterResponse = await registrationClient.api.authControllerRegister({
    email,
    firstName: getSeedName(options.role, options.workerIndex).firstName,
    lastName: getSeedName(options.role, options.workerIndex).lastName,
    password: options.password,
    language: "en",
  });

  const userFactory = options.factories.createUserFactory();
  await userFactory.update(userRegisterResponse.data.data.id, {
    roleSlugs: [options.role],
  });

  const authStatePath = getWorkerTenantAuthStatePath(
    options.projectName,
    options.workerIndex,
    options.tenantId,
    options.role,
  );

  await writeWorkerAuthState(options.browser, email, authStatePath, options.origin);

  return authStatePath;
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
    _ensureWorkerAuthReady: () => Promise<void>;
    _getWorkerTenantWorkspace: () => Promise<WorkerTenantWorkspace>;
  }
>({
  _ensureWorkerAuthReady: [
    async ({ browser }, use, workerInfo) => {
      let setupPromise: Promise<void> | undefined;

      await use(async () => {
        setupPromise ??= (async () => {
          const apiClient = createFixtureApiClient();
          const origin = new URL(DEFAULT_BASE_URL).origin;
          const adminContext = await browser.newContext({ baseURL: origin });
          const adminPage = await adminContext.newPage();
          const workerAuthStates: { email: string; path: string }[] = [];

          try {
            await addWorkspaceInitScript(adminContext, origin);
            await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD, { origin });

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
            await writeWorkerAuthState(browser, email, path, origin);
          }
        })();

        await setupPromise;
      });
    },
    { scope: "worker", timeout: 90 * 1000 },
  ],
  _getWorkerTenantWorkspace: [
    async ({ browser }, use, workerInfo) => {
      let setupPromise: Promise<WorkerTenantWorkspace> | undefined;
      let cleanupApiClient: FixtureApiClient | undefined;
      let tenant: TenantFactoryRecord | undefined;

      await use(async () => {
        setupPromise ??= (async () => {
          const origin = new URL(DEFAULT_BASE_URL).origin;
          const adminContext = await browser.newContext({ baseURL: origin });
          const adminPage = await adminContext.newPage();
          const apiClient = createFixtureApiClient();
          cleanupApiClient = createFixtureApiClient();

          try {
            await addWorkspaceInitScript(adminContext, origin);
            await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
            await apiClient.syncFromContext(adminContext, origin);
            await cleanupApiClient.syncFromContext(adminContext, origin);

            const rootFactories = createFixtureFactories(apiClient);
            const tenantFactory = rootFactories.createTenantFactory();
            const tenantInput = createIsolatedTenantInput(DEFAULT_BASE_URL, {
              name: `Worker Workspace ${workerInfo.project.name} ${workerInfo.workerIndex}`,
            });

            tenant = await tenantFactory.create(tenantInput);

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

            await completeCreatePasswordFromInvite(
              workspaceOrigin,
              inviteLink,
              tenantAdminPassword,
            );

            const tenantAdminContext = await browser.newContext({ baseURL: workspaceOrigin });
            await addWorkspaceInitScript(tenantAdminContext, workspaceOrigin);
            const tenantAdminPage = await tenantAdminContext.newPage();

            try {
              await login(tenantAdminPage, tenantAdminEmail, tenantAdminPassword, {
                origin: workspaceOrigin,
              });
              await apiClient.syncFromContext(tenantAdminContext, workspaceOrigin);
              await markAllOnboardingComplete(apiClient);

              const tenantFactories = createFixtureFactories(apiClient);
              const authStatePaths = {} as Record<UserRole, string>;

              for (const role of AUTH_ROLES) {
                authStatePaths[role] = await createTenantRoleUserAuthState({
                  browser,
                  factories: tenantFactories,
                  origin: workspaceOrigin,
                  password: ACCOUNT_PASSWORD,
                  projectName: workerInfo.project.name,
                  role,
                  tenantId: tenant.id,
                  workerIndex: workerInfo.workerIndex,
                });
              }

              return {
                authStatePaths,
                origin: workspaceOrigin,
                tenant,
              };
            } finally {
              await tenantAdminContext.close();
            }
          } finally {
            apiClient.clearCookies();
            await adminContext.close();
          }
        })();

        return setupPromise;
      });

      if (cleanupApiClient) {
        if (tenant) {
          const cleanupTenantFactory =
            createFixtureFactories(cleanupApiClient).createTenantFactory();
          await cleanupTenantFactory.deactivate(tenant.id);
        }

        cleanupApiClient.clearCookies();
      }
    },
    { scope: "worker", timeout: 120 * 1000 },
  ],
  withWorkerPage: async (
    {
      _ensureWorkerAuthReady,
      _getWorkerTenantWorkspace,
      apiClient,
      baseURL,
      browser,
      withWorkerPage,
    }: {
      _ensureWorkerAuthReady: () => Promise<void>;
      _getWorkerTenantWorkspace: () => Promise<WorkerTenantWorkspace>;
      apiClient: FixtureApiClient;
      baseURL?: string;
      browser: Browser;
      withWorkerPage: WithAuthPage;
    },
    use: (value: WithAuthPage) => Promise<void>,
  ) => {
    await use(
      async (
        role: UserRole,
        run: (handle: PageHandle) => Promise<void>,
        options?: WithAuthPageOptions,
      ) => {
        if (options?.root) {
          await _ensureWorkerAuthReady();
          await withWorkerPage(role, async (handle) => {
            const origin = new URL(baseURL!).origin;

            await apiClient.syncFromContext(handle.context, origin);

            await run(handle);
          });

          return;
        }

        const workerTenantWorkspace = await _getWorkerTenantWorkspace();
        const context = await browser.newContext({
          baseURL: workerTenantWorkspace.origin,
          storageState: workerTenantWorkspace.authStatePaths[role],
        });

        try {
          await addWorkspaceInitScript(context, workerTenantWorkspace.origin);
          const page = await context.newPage();

          await apiClient.syncFromContext(context, workerTenantWorkspace.origin);

          await run({ context, page });
        } finally {
          await context.close();
        }
      },
    );
  },
  withReadonlyPage: async (
    {
      withWorkerPage,
    }: {
      withWorkerPage: WithAuthPage;
    },
    use: (value: WithAuthPage) => Promise<void>,
  ) => {
    await use(
      async (
        role: UserRole,
        run: (handle: PageHandle) => Promise<void>,
        options?: WithAuthPageOptions,
      ) => {
        await withWorkerPage(role, run, options);
      },
    );
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
      await addWorkspaceInitScript(tenantContext, workspaceOrigin);

      const invitationMessage = await waitForMailhogMessage({
        recipient: tenantAdminEmail,
        subjectIncludes: "You're invited to the platform!",
      });
      const inviteLink = extractLinkFromMailhogMessage(
        invitationMessage,
        "/auth/create-new-password",
      );

      await completeCreatePasswordFromInvite(workspaceOrigin, inviteLink, tenantAdminPassword);
      await login(tenantPage, tenantAdminEmail, tenantAdminPassword, { origin: workspaceOrigin });

      await apiClient.syncFromContext(tenantContext, workspaceOrigin);
      await markAllOnboardingComplete(apiClient);

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
        await markAllOnboardingComplete(userApiClient);
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
