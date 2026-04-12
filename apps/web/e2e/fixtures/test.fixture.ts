import { expect, mergeTests } from "@playwright/test";

import { cleanupFixture } from "./cleanup.fixture";
import { factoryFixture } from "./factory.fixture";
import { pageFixture } from "./page.fixture";

import type { PageHandle } from "./types";
import type { UserRole } from "~/config/userRoles";

type WithAuthPage = (role: UserRole, run: (handle: PageHandle) => Promise<void>) => Promise<void>;

const mergedFixture = mergeTests(pageFixture, factoryFixture, cleanupFixture);

export const test = mergedFixture.extend<{
  withReadonlyPage: WithAuthPage;
  withWorkerPage: WithAuthPage;
}>({
  withReadonlyPage: async ({ apiClient, baseURL, withReadonlyPage }, use) => {
    await use(async (role, run) => {
      await withReadonlyPage(role, async (handle) => {
        const origin = new URL(baseURL!).origin;

        apiClient.syncTenantOrigin(origin);
        apiClient.syncCookies(await handle.context.cookies(origin));

        try {
          await run(handle);
        } finally {
          apiClient.clearCookies();
        }
      });
    });
  },
  withWorkerPage: async ({ apiClient, baseURL, withWorkerPage }, use) => {
    await use(async (role, run) => {
      await withWorkerPage(role, async (handle) => {
        const origin = new URL(baseURL!).origin;

        apiClient.syncTenantOrigin(origin);
        apiClient.syncCookies(await handle.context.cookies(origin));

        try {
          await run(handle);
        } finally {
          apiClient.clearCookies();
        }
      });
    });
  },
});

export { expect };
