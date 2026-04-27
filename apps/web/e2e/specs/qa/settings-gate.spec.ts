import { USER_ROLE } from "~/config/userRoles";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { prepareNavigationPageFlow } from "../../flows/navigation/prepare-navigation-page.flow";
import { ensureQAFeatures, setQAFeatureState } from "../../utils/qa-features";

import type { Page } from "@playwright/test";

const openContentMenuIfPresent = async (page: Page) => {
  const qaLink = page.getByTestId(NAVIGATION_HANDLES.QA_LINK);

  if (await qaLink.isVisible()) return;

  const contentGroup = page.getByTestId(NAVIGATION_HANDLES.CONTENT_GROUP);

  if (await contentGroup.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await contentGroup.click();
  }
};

const openContentMenu = async (page: Page) => {
  const qaLink = page.getByTestId(NAVIGATION_HANDLES.QA_LINK);

  if (await qaLink.isVisible({ timeout: 5_000 }).catch(() => false)) return;

  const contentGroup = page.getByTestId(NAVIGATION_HANDLES.CONTENT_GROUP);

  await expect(contentGroup).toBeVisible({ timeout: 30_000 });
  await contentGroup.click();
};

test("admin navigation reflects whether Q&A is enabled", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const restoreQAFeatures = await ensureQAFeatures(apiClient, {
      QAEnabled: false,
      unregisteredUserQAAccessibility: false,
    });

    cleanup.add(restoreQAFeatures);

    await prepareNavigationPageFlow(page);
    await openContentMenuIfPresent(page);
    await expect(page.getByTestId(NAVIGATION_HANDLES.QA_LINK)).toHaveCount(0);
  });

  await setQAFeatureState(apiClient, { QAEnabled: true });
  await expect
    .poll(async () => {
      const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();
      return response.data.data.QAEnabled;
    })
    .toBe(true);

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await prepareNavigationPageFlow(page);
    await openContentMenu(page);

    await expect(page.getByTestId(NAVIGATION_HANDLES.QA_LINK)).toBeVisible({ timeout: 30_000 });
  });
});
