import { USER_ROLE } from "~/config/userRoles";

import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { mockEnvConfigurationIssuesFlow } from "../../flows/settings/mock-settings-env.flow";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";

test("student opens settings from the profile menu and sees only their own account settings", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await openSettingsPageFlow(page);

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ACCOUNT_TAB)).toHaveAttribute(
      "data-state",
      "active",
    );
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ACCOUNT_CONTENT)).toBeVisible();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.LANGUAGE_SELECT)).toBeVisible();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_OLD)).toBeVisible();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_NEW)).toBeVisible();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_CONFIRM)).toBeVisible();

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB)).toHaveCount(0);
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB)).toHaveCount(0);
    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.REGISTRATION_FORM_BUILDER_CARD),
    ).toHaveCount(0);
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_CARD)).toHaveCount(0);
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.NOTIFICATION_PREFERENCES_CARD)).toHaveCount(
      0,
    );
  });
});

test("admin with settings management permission sees all settings tabs", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openSettingsPageFlow(page);

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ACCOUNT_TAB)).toBeVisible();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB)).toBeVisible();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB)).toBeVisible();
  });
});

test("organization tab shows warning indicator when configuration issues are not dismissed", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await mockEnvConfigurationIssuesFlow(page);
    await openSettingsPageFlow(page);

    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_WARNING_INDICATOR),
    ).toBeVisible();
  });
});
