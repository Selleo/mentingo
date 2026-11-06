import { expect } from "@playwright/test";
import { getSelfOnboardingDemoEmail, SUPPORTED_LANGUAGES } from "@repo/shared";

import { markAllOnboardingComplete } from "../utils/onboarding";
import { getSelfOnboardingLanguage } from "../utils/self-onboarding-context";

import { authenticateContext } from "./auth.actions";
import { test as base } from "./test.fixture";

/** Reuse the populated demo tenant instead of creating E2E worker identities. */
export const test = base.extend({
  withWorkerPage: async ({ browser, apiClient, baseURL }, use) => {
    if (!baseURL || process.env.SELF_ONBOARDING_DEMO !== "1") {
      throw new Error("Self-onboarding pages require the isolated demo seed");
    }

    await use(async (role, run) => {
      const origin = new URL(baseURL).origin;
      const language = getSelfOnboardingLanguage();
      const context = await browser.newContext({
        baseURL: origin,
        locale: language === SUPPORTED_LANGUAGES.PL ? "pl-PL" : "en-US",
      });

      try {
        await authenticateContext(
          context,
          origin,
          getSelfOnboardingDemoEmail(role, origin),
          "password",
        );
        await apiClient.syncFromContext(context, origin);
        await apiClient.api.settingsControllerUpdateUserSettings({ language });
        await markAllOnboardingComplete(apiClient);
        const page = await context.newPage();
        await run({ context, origin, page });
        if (!page.isClosed() && page.url() !== "about:blank") {
          await expect(page.locator("html")).toHaveAttribute("lang", language);
        }
      } finally {
        await context.close();
      }
    });
  },
  createWorkspaceContext: async ({ browser, baseURL }, use) => {
    if (!baseURL) throw new Error("Self-onboarding requires a base URL");
    await use(async (options = {}) => {
      const origin = new URL(baseURL).origin;
      const context = await browser.newContext({
        baseURL: origin,
        storageState: options.storageState,
        locale: getSelfOnboardingLanguage() === SUPPORTED_LANGUAGES.PL ? "pl-PL" : "en-US",
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
