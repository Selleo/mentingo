import { MAX_LOGIN_PAGE_DOCUMENTS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";

import type { FixtureApiClient } from "../../utils/api-client";
import type { Page } from "@playwright/test";

const openOrganizationSettings = async (page: Page) => {
  await openSettingsPageFlow(page);
  await page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB).click();
  await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_CONTENT)).toBeVisible();
};

const removeLoginPageFilesByPrefix = async (apiClient: FixtureApiClient, prefix: string) => {
  const response = await apiClient.api.settingsControllerGetLoginPageFiles();
  const resources = response.data.resources.filter((resource) => resource.name.startsWith(prefix));

  for (const resource of resources) {
    await apiClient.api.settingsControllerDeleteLoginPageFile(resource.id);
  }
};

const uploadLoginPageDocument = async (page: Page, displayName: string) => {
  await page
    .getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILES_INPUT)
    .setInputFiles(CURRICULUM_TEST_DATA.files.documentPreview);
  await page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_NAME_INPUT).fill(displayName);
  await page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_SAVE).click();
  await expect(
    page.getByTestId(SETTINGS_PAGE_HANDLES.loginPageFileItem(displayName)),
  ).toBeVisible();
};

test("admin can upload a login-page document with a display name", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  const prefix = `settings-login-file-${Date.now()}`;
  const displayName = `${prefix}-upload`;
  cleanup.add(async () => removeLoginPageFilesByPrefix(apiClient, prefix));

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openOrganizationSettings(page);
    await uploadLoginPageDocument(page, displayName);

    await expect
      .poll(async () => {
        const response = await apiClient.api.settingsControllerGetLoginPageFiles();

        return response.data.resources.some((resource) => resource.name === displayName);
      })
      .toBe(true);
  });
});

test("login-page file upload validates that the display name is present", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openOrganizationSettings(page);

    await page
      .getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILES_INPUT)
      .setInputFiles(CURRICULUM_TEST_DATA.files.documentPreview);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_NAME_INPUT).fill("");
    await page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_SAVE).click();

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_NAME_ERROR)).toBeVisible();
  });
});

test("admin can preview an uploaded login-page document", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  const prefix = `settings-login-file-${Date.now()}`;
  const displayName = `${prefix}-preview`;
  cleanup.add(async () => removeLoginPageFilesByPrefix(apiClient, prefix));

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openOrganizationSettings(page);
    await uploadLoginPageDocument(page, displayName);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.loginPageFilePreview(displayName)).click();
    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_PREVIEW_DIALOG),
    ).toBeVisible();
    await expect(page.locator(`iframe[title="${displayName}"]`)).toBeVisible();
  });
});

test("admin can delete an uploaded login-page document after confirmation", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  const prefix = `settings-login-file-${Date.now()}`;
  const displayName = `${prefix}-delete`;
  cleanup.add(async () => removeLoginPageFilesByPrefix(apiClient, prefix));

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openOrganizationSettings(page);
    await uploadLoginPageDocument(page, displayName);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.loginPageFileDelete(displayName)).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_DELETE_CONFIRM).click();

    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.loginPageFileItem(displayName)),
    ).toHaveCount(0);
    await expect
      .poll(async () => {
        const response = await apiClient.api.settingsControllerGetLoginPageFiles();

        return response.data.resources.some((resource) => resource.name === displayName);
      })
      .toBe(false);
  });
});

test("add-file button is disabled when the maximum number of login-page files is reached", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  const prefix = `settings-login-file-${Date.now()}`;
  cleanup.add(async () => removeLoginPageFilesByPrefix(apiClient, prefix));

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openOrganizationSettings(page);

    const response = await apiClient.api.settingsControllerGetLoginPageFiles();
    const filesToAdd = Math.max(0, MAX_LOGIN_PAGE_DOCUMENTS - response.data.resources.length);

    for (let index = 0; index < filesToAdd; index += 1) {
      await uploadLoginPageDocument(page, `${prefix}-max-${index}`);
    }

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILES_ADD)).toBeDisabled();
  });
});
