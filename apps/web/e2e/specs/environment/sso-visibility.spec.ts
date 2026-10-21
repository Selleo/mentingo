import { LOGIN_METHODS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { ENV_SECRET_NAMES, SSO_LOGIN_HANDLES } from "../../data/environment/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openLoginPageFlow } from "../../flows/auth/open-login-page.flow";

import type { Browser } from "@playwright/test";

test.setTimeout(180 * 1000);

const openAnonymousLoginPage = async (browser: Browser, origin: string) => {
  const context = await browser.newContext({ baseURL: origin });
  const page = await context.newPage();
  await openLoginPageFlow(page);

  return { context, page };
};

test("frontend SSO button follows the organization's Google login switch", async ({
  browser,
  withIsolatedWorkerPage,
}) => {
  await withIsolatedWorkerPage(USER_ROLE.admin, async ({ apiClient, origin }) => {
    await apiClient.api.envControllerBulkUpsertEnv([
      { name: ENV_SECRET_NAMES.GOOGLE_CLIENT_ID, value: "e2e-google-client-id" },
      { name: ENV_SECRET_NAMES.GOOGLE_CLIENT_SECRET, value: "e2e-google-client-secret" },
    ]);
    await apiClient.api.envControllerUpdateLoginMethod({
      method: LOGIN_METHODS.GOOGLE,
      enabled: true,
    });

    const enabledLogin = await openAnonymousLoginPage(browser, origin);
    try {
      await expect(enabledLogin.page.getByTestId(SSO_LOGIN_HANDLES.GOOGLE)).toBeVisible();
    } finally {
      await enabledLogin.context.close();
    }

    await apiClient.api.envControllerUpdateLoginMethod({
      method: LOGIN_METHODS.GOOGLE,
      enabled: false,
    });

    const disabledLogin = await openAnonymousLoginPage(browser, origin);
    try {
      await expect(disabledLogin.page.getByTestId(SSO_LOGIN_HANDLES.GOOGLE)).toHaveCount(0);
    } finally {
      await disabledLogin.context.close();
    }
  });
});
