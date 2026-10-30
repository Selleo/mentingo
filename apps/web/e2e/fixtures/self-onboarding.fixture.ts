import { getSelfOnboardingDemoEmail } from "@repo/shared";

import { markAllOnboardingComplete } from "../utils/onboarding";

import { authenticateContext } from "./auth.actions";
import { test as base } from "./test.fixture";

/** Reuse the populated demo tenant instead of creating E2E worker identities. */
export const test = base.extend({
  withWorkerPage: async ({ browser, apiClient, baseURL }, use) => {
    if (process.env.SELF_ONBOARDING_DEMO !== "1") {
      throw new Error("Self-onboarding pages require the isolated demo seed");
    }

    await use(async (role, run) => {
      const origin = new URL(baseURL!).origin;
      const context = await browser.newContext({ baseURL: origin });

      try {
        await authenticateContext(
          context,
          origin,
          getSelfOnboardingDemoEmail(role, origin),
          "password",
        );
        await apiClient.syncFromContext(context, origin);
        await markAllOnboardingComplete(apiClient);
        const page = await context.newPage();
        await run({ context, origin, page });
      } finally {
        await context.close();
      }
    });
  },
  createWorkspaceContext: async ({ browser, baseURL }, use) => {
    await use(async (options = {}) => {
      const origin = new URL(baseURL!).origin;
      const context = await browser.newContext({
        baseURL: origin,
        storageState: options.storageState,
      });
      return { context, origin };
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

export { expect } from "@playwright/test";
