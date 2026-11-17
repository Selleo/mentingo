import { LOGIN_METHODS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { ENV_SECRET_NAMES, SSO_LOGIN_HANDLES } from "../../data/environment/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openLoginPageFlow } from "../../flows/auth/open-login-page.flow";

// Two isolated-workspace logins plus provider configuration exceed the default 90 s.
test.setTimeout(180 * 1000);

test("frontend SSO button follows the organization's Google login switch", async ({
  cleanup,
  createWorkspacePage,
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

    const visitor = await createWorkspacePage({ origin });
    cleanup.add(() => visitor.context.close());

    await openLoginPageFlow(visitor.page);
    await expect(visitor.page.getByTestId(SSO_LOGIN_HANDLES.GOOGLE)).toBeVisible();

    await apiClient.api.envControllerUpdateLoginMethod({
      method: LOGIN_METHODS.GOOGLE,
      enabled: false,
    });

    await openLoginPageFlow(visitor.page);
    await expect(visitor.page.getByTestId(SSO_LOGIN_HANDLES.GOOGLE)).toHaveCount(0);
  });
});
