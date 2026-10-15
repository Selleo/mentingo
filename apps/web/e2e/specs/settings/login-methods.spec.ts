import { USER_ROLE } from "~/config/userRoles";

import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";

test("organization login methods persist and disabled password disappears on the public login page", async ({
  withIsolatedWorkerPage,
  browser,
}, testInfo) => {
  await withIsolatedWorkerPage(USER_ROLE.admin, async ({ page, origin }) => {
    await openSettingsPageFlow(page);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB).click();
    const magic = page.getByRole("switch", { name: "Magic link", exact: true });
    await expect(magic).toBeChecked();
    const password = page.getByRole("switch", { name: "Password", exact: true });
    await expect(password).toBeChecked();
    await password.click();
    await expect(password).not.toBeChecked();
    const config = await page.request.get(`${origin}/api/env/login-methods`);
    expect(config.ok()).toBeTruthy();
    expect((await config.json()).data.password).toBe(false);
    await page.reload();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB).click();
    await expect(page.getByRole("switch", { name: "Password", exact: true })).not.toBeChecked();
    await page.screenshot({
      path: testInfo.outputPath("organization-login-methods.png"),
      fullPage: true,
    });
    const publicContext = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
    try {
      const login = await publicContext.newPage();
      await login.goto(`${origin}/auth/login`);
      await expect(login.getByRole("link", { name: "Email me a login link" })).toBeVisible();
      await expect(login.locator("form")).toHaveCount(0);
      await expect(login.getByText("Or continue with", { exact: true })).toHaveCount(0);
      await expect(login.getByText("Enter your email below to login to your account")).toHaveCount(
        0,
      );
      await login.screenshot({
        path: testInfo.outputPath("password-disabled-login.png"),
        fullPage: true,
      });
    } finally {
      await publicContext.close();
    }
  });
});
