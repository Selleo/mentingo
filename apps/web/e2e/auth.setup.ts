import { test as setup } from "@playwright/test";
import { getSelfOnboardingDemoEmail, SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { login } from "./fixtures/auth.actions";
import { createFixtureApiClient } from "./utils/api-client";
import { markAllOnboardingComplete } from "./utils/onboarding";

const ADMIN_PASSWORD = "password";
const apiClient = createFixtureApiClient();

setup("authenticate", async ({ browser }, testInfo) => {
  const origin = process.env.CI
    ? "https://localhost:5173"
    : process.env.VITE_APP_URL || "https://tenant1.lms.localhost";
  const adminEmail =
    process.env.SELF_ONBOARDING_DEMO === "1"
      ? getSelfOnboardingDemoEmail(SYSTEM_ROLE_SLUGS.ADMIN, origin)
      : "admin@example.com";
  const adminContext = await browser.newContext({ baseURL: origin });
  const adminPage = await adminContext.newPage();

  try {
    await login(adminPage, adminEmail, ADMIN_PASSWORD, { origin });
    apiClient.syncTenantOrigin(origin);
    apiClient.syncCookies(await adminContext.cookies());
    await markAllOnboardingComplete(apiClient);
  } catch (error) {
    if (process.env.DEMO_FAILURE_SCREENSHOTS === "1") {
      await adminPage
        .screenshot({
          path: testInfo.outputPath("self-onboarding-auth-failure.png"),
          fullPage: true,
        })
        .catch(() => undefined);
    }
    throw error;
  } finally {
    apiClient.clearCookies();
    await adminContext.close();
  }
});
