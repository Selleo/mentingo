import { USER_ROLE } from "~/config/userRoles";

import { ENV_SECRET_NAMES, SSO_LOGIN_HANDLES } from "../../data/environment/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openLoginPageFlow } from "../../flows/auth/open-login-page.flow";
import { getEffectiveSsoSecretValue, upsertEnvSecretValue } from "../../utils/environment";

const SECRET_NAME = ENV_SECRET_NAMES.VITE_GOOGLE_OAUTH_ENABLED;

test.setTimeout(180 * 1000);

test("frontend SSO button follows the tenant env value", async ({
  apiClient,
  cleanup,
  createWorkspacePage,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async () => {
    const originalValue = await getEffectiveSsoSecretValue(apiClient, SECRET_NAME);

    cleanup.add(async () => {
      await upsertEnvSecretValue(apiClient, SECRET_NAME, originalValue);
    });

    await upsertEnvSecretValue(apiClient, SECRET_NAME, "true");

    await expect
      .poll(async () => (await apiClient.api.envControllerGetFrontendSsoEnabled()).data.data.google)
      .toBe("true");
  });

  const enabledPage = await createWorkspacePage();
  try {
    await openLoginPageFlow(enabledPage.page);
    await expect(enabledPage.page.getByTestId(SSO_LOGIN_HANDLES.GOOGLE)).toBeVisible();
  } finally {
    await enabledPage.context.close();
  }

  await withWorkerPage(USER_ROLE.admin, async () => {
    await upsertEnvSecretValue(apiClient, SECRET_NAME, "false");

    await expect
      .poll(async () => (await apiClient.api.envControllerGetFrontendSsoEnabled()).data.data.google)
      .toBe("false");
  });

  const disabledPage = await createWorkspacePage();
  try {
    await openLoginPageFlow(disabledPage.page);
    await expect(disabledPage.page.getByTestId(SSO_LOGIN_HANDLES.GOOGLE)).toHaveCount(0);
  } finally {
    await disabledPage.context.close();
  }
});
