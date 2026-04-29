import { USER_ROLE } from "~/config/userRoles";

import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";
import { markAllOnboardingComplete } from "../../utils/onboarding";

test("password form blocks submit for missing current password weak password and mismatch", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await openSettingsPageFlow(page);

    const saveButton = page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_SAVE);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_NEW).fill("Password123@");
    await page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_CONFIRM).fill("Password123@");
    await expect(saveButton).toBeDisabled();

    await page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_OLD).fill("Password123@");
    await page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_NEW).fill("short");
    await page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_CONFIRM).fill("short");
    await expect(saveButton).toBeDisabled();

    await page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_NEW).fill("Password123@");
    await page.getByTestId(SETTINGS_PAGE_HANDLES.PASSWORD_CONFIRM).fill("Different123@");
    await expect(saveButton).toBeDisabled();
  });
});

test("admin can generate an integration API key", async ({ apiClient, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openSettingsPageFlow(page);

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_CARD)).toBeVisible();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_GENERATE).click();

    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_GENERATED),
    ).toContainText("itgk_");

    await expect
      .poll(async () => {
        const response = await apiClient.api.integrationAdminControllerGetCurrentKey();

        return response.data.data.key?.keyPrefix;
      })
      .toBeTruthy();
  });
});

test("admin with an existing integration API key must confirm before rotating it", async ({
  apiClient,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const generatedKey = await apiClient.api.integrationAdminControllerRotateKey();
    const originalPrefix = generatedKey.data.data.metadata.keyPrefix;

    await openSettingsPageFlow(page);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_OVERRIDE).click();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_GENERATED)).toHaveCount(
      0,
    );

    const keyBeforeConfirm = await apiClient.api.integrationAdminControllerGetCurrentKey();
    expect(keyBeforeConfirm.data.data.key?.keyPrefix).toBe(originalPrefix);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_CONFIRM_ROTATE).click();
    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_GENERATED),
    ).toContainText("itgk_");

    await expect
      .poll(async () => {
        const response = await apiClient.api.integrationAdminControllerGetCurrentKey();

        return response.data.data.key?.keyPrefix;
      })
      .not.toBe(originalPrefix);
  });
});

test("user with onboarding reset permission can reset onboarding", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    cleanup.add(async () => {
      await markAllOnboardingComplete(apiClient);
    });

    await markAllOnboardingComplete(apiClient);
    await openSettingsPageFlow(page);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.RESET_ONBOARDING_BUTTON).click();

    await expect
      .poll(async () => {
        const response = await apiClient.api.authControllerCurrentUser();

        return response.data.data.onboardingStatus.settings;
      })
      .toBe(false);
  });
});
