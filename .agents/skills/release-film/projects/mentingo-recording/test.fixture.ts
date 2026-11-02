import { markAllOnboardingComplete } from "../utils/onboarding";

import { authenticateContext } from "./auth.actions";
import { RECORDING_ACCOUNTS, RECORDING_ORIGIN } from "./release-film.accounts";
import { test as base } from "./release-film.base.fixture";

// Every existing scene import now uses seeded demo accounts, without E2E worker tenants.
export const test = base.extend({
  withWorkerPage: async ({ browser, apiClient, baseURL }, use) => {
    if (
      !baseURL ||
      process.env.RELEASE_FILM_DEMO !== "1" ||
      new URL(baseURL).origin !== RECORDING_ORIGIN
    ) {
      throw new Error(
        "Release-film demo fixtures require the isolated localhost recording environment",
      );
    }
    await use(async (role, run) => {
      const context = await browser.newContext({ baseURL: RECORDING_ORIGIN });
      try {
        await authenticateContext(context, RECORDING_ORIGIN, RECORDING_ACCOUNTS[role], "password");
        await apiClient.syncFromContext(context, RECORDING_ORIGIN);
        await markAllOnboardingComplete(apiClient);
        const page = await context.newPage();
        await run({ context, origin: RECORDING_ORIGIN, page });
      } finally {
        await context.close();
      }
    });
  },
  createWorkspaceContext: async ({ browser }, use) => {
    await use(async (options = {}) => {
      const context = await browser.newContext({
        baseURL: RECORDING_ORIGIN,
        storageState: options.storageState,
      });
      return { context, origin: RECORDING_ORIGIN };
    });
  },
  workerTenantApiClient: async ({ apiClient }, use) => {
    await use(apiClient);
  },
  createIsolatedWorkspace: async ({ baseURL }, use) => {
    void baseURL;
    await use(async () => {
      throw new Error("Record with withWorkerPage in the populated demo tenant");
    });
  },
  withIsolatedWorkerPage: async ({ baseURL }, use) => {
    void baseURL;
    await use(async () => {
      throw new Error("Record with withWorkerPage in the populated demo tenant");
    });
  },
});

export type * from "./release-film.base.fixture";
export { expect } from "@playwright/test";
