import { LOGIN_METHODS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { LOGIN_PAGE_HANDLES, REGISTER_PAGE_HANDLES } from "../../data/auth/handles";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { TEST_PASSWORD } from "../../data/test-data/credentials.data";
import { expect, test } from "../../fixtures/test.fixture";
import { openLoginPageFlow } from "../../flows/auth/open-login-page.flow";
import { openSettingsPageAtOriginFlow } from "../../flows/settings/open-settings-page.flow";
import { toggleLoginMethodFlow } from "../../flows/settings/toggle-login-method.flow";

test("disabling password login persists and hides the password form on the public login page", async ({
  cleanup,
  createWorkspacePage,
  withIsolatedWorkerPage,
}) => {
  await withIsolatedWorkerPage(USER_ROLE.admin, async ({ page, origin, apiClient }) => {
    const passwordSwitch = page.getByTestId(
      SETTINGS_PAGE_HANDLES.loginMethodSwitch(LOGIN_METHODS.PASSWORD),
    );

    await openSettingsPageAtOriginFlow(page, origin);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB).click();
    await expect(passwordSwitch).toBeChecked();

    await toggleLoginMethodFlow(page, LOGIN_METHODS.PASSWORD);

    await expect(passwordSwitch).not.toBeChecked();
    await expect
      .poll(async () => (await apiClient.api.envControllerGetLoginMethods()).data.data.password)
      .toBe(false);

    await page.reload();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB).click();
    await expect(passwordSwitch).not.toBeChecked();

    const visitor = await createWorkspacePage({ origin });
    cleanup.add(() => visitor.context.close());
    const loginPage = visitor.page;
    await openLoginPageFlow(loginPage);

    await expect(loginPage.getByTestId(LOGIN_PAGE_HANDLES.MAGIC_LINK_LINK)).toBeVisible();
    await expect(loginPage.getByTestId(LOGIN_PAGE_HANDLES.PASSWORD_LOGIN_FORM)).toHaveCount(0);
    await expect(loginPage.getByTestId(LOGIN_PAGE_HANDLES.ALTERNATIVE_LOGIN_SEPARATOR)).toHaveCount(
      0,
    );
    await expect(loginPage.getByTestId(LOGIN_PAGE_HANDLES.REGISTER_LINK)).toHaveCount(0);

    const returnSearch = "?returnTo=%2Fcourses%2Fcourse-1";
    await loginPage.goto(`/auth/register${returnSearch}`);
    await expect(loginPage).toHaveURL(`${origin}/auth/login${returnSearch}`);
    await expect(loginPage.getByTestId(REGISTER_PAGE_HANDLES.PAGE)).toHaveCount(0);
    await loginPage.reload();
    await expect(loginPage).toHaveURL(`${origin}/auth/login${returnSearch}`);
    await expect(loginPage.getByTestId(LOGIN_PAGE_HANDLES.MAGIC_LINK_LINK)).toBeVisible();

    const registration = await visitor.context.request.post(`${origin}/api/auth/register`, {
      data: {
        email: `disabled-password-${Date.now()}@example.com`,
        firstName: "Disabled",
        lastName: "Registration",
        password: TEST_PASSWORD,
        language: "en",
      },
    });
    expect(registration.status()).toBe(401);

    await toggleLoginMethodFlow(page, LOGIN_METHODS.PASSWORD);
    await expect(passwordSwitch).toBeChecked();
    await expect
      .poll(async () => (await apiClient.api.envControllerGetLoginMethods()).data.data.password)
      .toBe(true);
    await loginPage.goto("/auth/register");
    await expect(loginPage.getByTestId(REGISTER_PAGE_HANDLES.PASSWORD)).toBeVisible();
    await expect(loginPage.getByTestId(REGISTER_PAGE_HANDLES.SUBMIT)).toBeVisible();
  });
});
