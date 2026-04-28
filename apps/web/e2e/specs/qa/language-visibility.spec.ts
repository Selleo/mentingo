import { USER_ROLE } from "~/config/userRoles";

import { QA_PAGE_HANDLES } from "../../data/qa/handles";
import { openQAPageFlow } from "../../flows/qa/open-qa-page.flow";

import { expect, test } from "./qa-test.fixture";

test("non-manager does not see Q&A entries missing the current UI language", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const qaFactory = factories.createQAFactory();
  let qaId = "";

  cleanup.add(async () => {
    if (!qaId) return;

    await withWorkerPage(USER_ROLE.admin, async () => {
      const existingQA = await qaFactory.safeGetById(qaId);

      if (existingQA) {
        await qaFactory.delete(qaId);
      }
    });
  });

  await withWorkerPage(USER_ROLE.admin, async () => {
    const qa = await qaFactory.create({
      language: "en",
      title: `qa-language-en-${Date.now()}`,
      description: `qa-language-en-answer-${Date.now()}`,
    });

    qaId = qa.id;
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    const originalSettingsResponse = await apiClient.api.settingsControllerGetUserSettings();
    const originalLanguage = originalSettingsResponse.data.data?.language;

    try {
      await apiClient.api.settingsControllerUpdateUserSettings({ language: "de" });
      await openQAPageFlow(page);

      await expect(page.getByTestId(QA_PAGE_HANDLES.item(qaId))).toHaveCount(0);
    } finally {
      if (originalLanguage) {
        await apiClient.api.settingsControllerUpdateUserSettings({ language: originalLanguage });
      }
    }
  });
});

test("admin can see Q&A entries even when the current UI language is missing", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const qaFactory = factories.createQAFactory();
  let qaId = "";

  cleanup.add(async () => {
    if (!qaId) return;

    await withWorkerPage(USER_ROLE.admin, async () => {
      const existingQA = await qaFactory.safeGetById(qaId);

      if (existingQA) {
        await qaFactory.delete(qaId);
      }
    });
  });

  await withWorkerPage(USER_ROLE.admin, async () => {
    const qa = await qaFactory.create({
      language: "en",
      title: `qa-language-admin-${Date.now()}`,
      description: `qa-language-admin-answer-${Date.now()}`,
    });

    qaId = qa.id;
  });

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalSettingsResponse = await apiClient.api.settingsControllerGetUserSettings();
    const originalLanguage = originalSettingsResponse.data.data?.language;

    try {
      await apiClient.api.settingsControllerUpdateUserSettings({ language: "de" });
      await openQAPageFlow(page);

      await expect(page.getByTestId(QA_PAGE_HANDLES.item(qaId))).toBeVisible();
    } finally {
      if (originalLanguage) {
        await apiClient.api.settingsControllerUpdateUserSettings({ language: originalLanguage });
      }
    }
  });
});
