import { USER_ROLE } from "~/config/userRoles";

import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";

test("user without user-management permission does not see registration form builder", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
    await openSettingsPageFlow(page);

    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.REGISTRATION_FORM_BUILDER_CARD),
    ).toHaveCount(0);
  });
});

test("user without integration API permission does not see integration API key card", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
    await openSettingsPageFlow(page);

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_CARD)).toHaveCount(0);
  });
});

test("user without course or user management permission does not see admin notification preferences", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
    await openSettingsPageFlow(page);

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.NOTIFICATION_PREFERENCES_CARD)).toHaveCount(
      0,
    );
  });
});

test("student-level user can still access language and password settings", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
    await openSettingsPageFlow(page);

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.LANGUAGE_SELECT)).toBeVisible();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_OLD)).toBeVisible();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_NEW)).toBeVisible();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_CONFIRM)).toBeVisible();
  });
});
