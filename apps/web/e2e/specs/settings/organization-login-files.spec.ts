import { MAX_LOGIN_PAGE_DOCUMENTS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { LOGIN_PAGE_HANDLES } from "../../data/auth/handles";
import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openLoginPageFlow } from "../../flows/auth/open-login-page.flow";
import { openOrganizationSettingsFlow } from "../../flows/settings/open-organization-settings.flow";
import { uploadLoginPageDocumentFlow } from "../../flows/settings/upload-login-page-document.flow";
import { waitForApiResponse } from "../../utils/api-requests";
import {
  getLoginPageFiles,
  removeLoginPageFilesByPrefix,
  uploadLoginPageFile,
} from "../../utils/login-page-files";

test("admin uploads, previews and deletes a login-page document that visitors see on the login page", async ({
  apiClient,
  cleanup,
  createWorkspacePage,
  withWorkerPage,
}) => {
  const displayName = `settings-login-file-${Date.now()}`;
  cleanup.add(async () => removeLoginPageFilesByPrefix(apiClient, displayName));

  const visitor = await createWorkspacePage();
  cleanup.add(() => visitor.context.close());

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openOrganizationSettingsFlow(page);
    await uploadLoginPageDocumentFlow(page, displayName);

    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.loginPageFileItem(displayName)),
    ).toBeVisible();
    let resourceId = "";
    await expect
      .poll(async () => {
        const files = await getLoginPageFiles(apiClient);
        resourceId = files.find((resource) => resource.name === displayName)?.id ?? "";
        return resourceId;
      })
      .not.toBe("");

    await openLoginPageFlow(visitor.page);
    await expect(visitor.page.getByTestId(LOGIN_PAGE_HANDLES.resource(resourceId))).toBeVisible();

    await page.getByTestId(SETTINGS_PAGE_HANDLES.loginPageFilePreview(displayName)).click();
    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_PREVIEW_DIALOG),
    ).toBeVisible();
    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_PREVIEW_DOCUMENT).locator("canvas"),
    ).toBeVisible();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_PREVIEW_CLOSE).click();

    await page.getByTestId(SETTINGS_PAGE_HANDLES.loginPageFileDelete(displayName)).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_DELETE_CONFIRM).click();

    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.loginPageFileItem(displayName)),
    ).toHaveCount(0);

    const loginPageFilesLoaded = waitForApiResponse(
      visitor.page,
      "GET",
      "/api/settings/login-page-files",
    );
    await openLoginPageFlow(visitor.page);
    await loginPageFilesLoaded;
    await expect(visitor.page.getByTestId(LOGIN_PAGE_HANDLES.resource(resourceId))).toHaveCount(0);
  });
});

test("login-page file upload validates that the display name is present", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openOrganizationSettingsFlow(page);

    await page
      .getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILES_INPUT)
      .setInputFiles(CURRICULUM_TEST_DATA.files.documentPreview);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_NAME_INPUT).fill("");
    await page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_SAVE).click();

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_NAME_ERROR)).toBeVisible();
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
    const existingFiles = await getLoginPageFiles(apiClient);

    for (let index = existingFiles.length; index < MAX_LOGIN_PAGE_DOCUMENTS; index += 1) {
      await uploadLoginPageFile(apiClient, `${prefix}-max-${index}`);
    }

    await openOrganizationSettingsFlow(page);

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILES_ADD)).toBeDisabled();
  });
});
