import { test as setup } from "@playwright/test";

import { login } from "./fixtures/auth.actions";
import { createFixtureApiClient } from "./utils/api-client";
import { markAllOnboardingComplete } from "./utils/onboarding";

const ADMIN_PASSWORD = "password";
const ADMIN_EMAIL = "admin@example.com";
const apiClient = createFixtureApiClient();

setup("authenticate", async ({ browser }) => {
  const origin = process.env.CI
    ? "http://localhost:5173"
    : process.env.VITE_APP_URL || "https://tenant1.lms.localhost";
  const adminContext = await browser.newContext({ baseURL: origin });
  const adminPage = await adminContext.newPage();

  try {
    await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD, { origin });
    apiClient.syncTenantOrigin(origin);
    apiClient.syncCookies(await adminContext.cookies());
    await markAllOnboardingComplete(apiClient);
  } finally {
    apiClient.clearCookies();
    await adminContext.close();
  }
});
