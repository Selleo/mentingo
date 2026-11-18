import { randomUUID } from "node:crypto";

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

const uniqueKeyName = () => `E2E key ${randomUUID().slice(0, 8)}`;

test("admin creates a named integration API key and sees it in the keys table", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  const keyName = uniqueKeyName();

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openSettingsPageFlow(page);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATIONS_TAB).click();

    await page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_CREATE).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_NAME_INPUT).fill(keyName);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_CONFIRM_CREATE).click();

    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_GENERATED),
    ).toContainText("itgk_");

    let createdKeyId: string | undefined;

    await expect
      .poll(async () => {
        const response = await apiClient.api.integrationAdminControllerGetKeys();

        createdKeyId = response.data.data.find((key) => key.name === keyName)?.id;

        return createdKeyId;
      })
      .toBeTruthy();

    if (!createdKeyId) throw new Error("The created integration API key is not listed");

    const keyId = createdKeyId;

    cleanup.add(async () => {
      await apiClient.api.integrationAdminControllerRevokeKey(keyId).catch(() => undefined);
    });

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.integrationApiKeyRow(keyId))).toContainText(
      keyName,
    );
  });
});

test("admin must confirm before an integration API key is revoked", async ({
  apiClient,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const createdKey = await apiClient.api.integrationAdminControllerCreateKey({
      name: uniqueKeyName(),
    });
    const keyId = createdKey.data.data.metadata.id;

    await openSettingsPageFlow(page);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATIONS_TAB).click();

    await page.getByTestId(SETTINGS_PAGE_HANDLES.integrationApiKeyRevoke(keyId)).click();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.integrationApiKeyRow(keyId))).toBeVisible();

    await page.getByTestId(SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_CONFIRM_REVOKE).click();

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.integrationApiKeyRow(keyId))).toHaveCount(
      0,
    );
    await expect
      .poll(async () => {
        const response = await apiClient.api.integrationAdminControllerGetKeys();

        return response.data.data.some((key) => key.id === keyId);
      })
      .toBe(false);
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
