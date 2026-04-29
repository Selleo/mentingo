import { USER_ROLE } from "~/config/userRoles";

import { QA_SETTINGS_HANDLES } from "../../data/qa/handles";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";

import type { FixtureApiClient } from "../../utils/api-client";
import type { Page } from "@playwright/test";
import type { GetPublicGlobalSettingsResponse } from "~/api/generated-api";

type GlobalSettings = GetPublicGlobalSettingsResponse["data"];

const openPlatformCustomizationSettings = async (page: Page) => {
  await openSettingsPageFlow(page);
  await page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB).click();
  await expect(
    page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_CONTENT),
  ).toBeVisible();
};

const getGlobalSettings = async (apiClient: FixtureApiClient) => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();

  return response.data.data;
};

test("admin can toggle public course visibility and modern course list settings", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalSettings = await getGlobalSettings(apiClient);

    cleanup.add(async () => {
      const currentSettings = await getGlobalSettings(apiClient);

      if (
        currentSettings.unregisteredUserCoursesAccessibility !==
        originalSettings.unregisteredUserCoursesAccessibility
      ) {
        await apiClient.api.settingsControllerUpdateUnregisteredUserCoursesAccessibility();
      }

      if (currentSettings.modernCourseListEnabled !== originalSettings.modernCourseListEnabled) {
        await apiClient.api.settingsControllerUpdateModernCourseListEnabled();
      }
    });

    await openPlatformCustomizationSettings(page);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.COURSES_VISIBILITY_SWITCH).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.MODERN_COURSE_LIST_SWITCH).click();

    await expect
      .poll(async () => {
        const settings = await getGlobalSettings(apiClient);

        return {
          modernCourseListEnabled: settings.modernCourseListEnabled,
          unregisteredUserCoursesAccessibility: settings.unregisteredUserCoursesAccessibility,
        };
      })
      .toEqual({
        modernCourseListEnabled: !originalSettings.modernCourseListEnabled,
        unregisteredUserCoursesAccessibility:
          !originalSettings.unregisteredUserCoursesAccessibility,
      });
  });
});

test("admin can enable Q&A and the public Q&A switch becomes available", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalSettings = await getGlobalSettings(apiClient);

    cleanup.add(async () => {
      await restoreFeatureSettings(apiClient, originalSettings);
    });

    await setFeatureState(apiClient, {
      QAEnabled: false,
      unregisteredUserQAAccessibility: false,
    });

    await openPlatformCustomizationSettings(page);
    await expect(page.getByTestId(QA_SETTINGS_HANDLES.PUBLIC_SWITCH)).toBeDisabled();
    await page.getByTestId(QA_SETTINGS_HANDLES.ENABLED_SWITCH).click();

    await expect.poll(async () => (await getGlobalSettings(apiClient)).QAEnabled).toBe(true);

    await page.reload();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB).click();
    await expect(page.getByTestId(QA_SETTINGS_HANDLES.PUBLIC_SWITCH)).toBeEnabled();
  });
});

test("admin can enable News and the public News switch becomes available", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalSettings = await getGlobalSettings(apiClient);

    cleanup.add(async () => {
      await restoreFeatureSettings(apiClient, originalSettings);
    });

    await setFeatureState(apiClient, {
      newsEnabled: false,
      unregisteredUserNewsAccessibility: false,
    });

    await openPlatformCustomizationSettings(page);
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.NEWS_PUBLIC_SWITCH)).toBeDisabled();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.NEWS_ENABLED_SWITCH).click();

    await expect.poll(async () => (await getGlobalSettings(apiClient)).newsEnabled).toBe(true);

    await page.reload();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB).click();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.NEWS_PUBLIC_SWITCH)).toBeEnabled();
  });
});

test("admin can enable Articles and the public Articles switch becomes available", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalSettings = await getGlobalSettings(apiClient);

    cleanup.add(async () => {
      await restoreFeatureSettings(apiClient, originalSettings);
    });

    await setFeatureState(apiClient, {
      articlesEnabled: false,
      unregisteredUserArticlesAccessibility: false,
    });

    await openPlatformCustomizationSettings(page);
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ARTICLES_PUBLIC_SWITCH)).toBeDisabled();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.ARTICLES_ENABLED_SWITCH).click();

    await expect.poll(async () => (await getGlobalSettings(apiClient)).articlesEnabled).toBe(true);

    await page.reload();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB).click();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ARTICLES_PUBLIC_SWITCH)).toBeEnabled();
  });
});

const setFeatureState = async (
  apiClient: FixtureApiClient,
  desired: Partial<
    Pick<
      GlobalSettings,
      | "QAEnabled"
      | "unregisteredUserQAAccessibility"
      | "newsEnabled"
      | "unregisteredUserNewsAccessibility"
      | "articlesEnabled"
      | "unregisteredUserArticlesAccessibility"
    >
  >,
) => {
  const currentSettings = await getGlobalSettings(apiClient);

  if (desired.QAEnabled !== undefined && currentSettings.QAEnabled !== desired.QAEnabled) {
    await apiClient.api.settingsControllerUpdateQaSetting("QAEnabled");
  }

  if (
    desired.unregisteredUserQAAccessibility !== undefined &&
    currentSettings.unregisteredUserQAAccessibility !== desired.unregisteredUserQAAccessibility
  ) {
    await apiClient.api.settingsControllerUpdateQaSetting("unregisteredUserQAAccessibility");
  }

  if (desired.newsEnabled !== undefined && currentSettings.newsEnabled !== desired.newsEnabled) {
    await apiClient.api.settingsControllerUpdateNewsSetting("newsEnabled");
  }

  if (
    desired.unregisteredUserNewsAccessibility !== undefined &&
    currentSettings.unregisteredUserNewsAccessibility !== desired.unregisteredUserNewsAccessibility
  ) {
    await apiClient.api.settingsControllerUpdateNewsSetting("unregisteredUserNewsAccessibility");
  }

  if (
    desired.articlesEnabled !== undefined &&
    currentSettings.articlesEnabled !== desired.articlesEnabled
  ) {
    await apiClient.api.settingsControllerUpdateArticlesSetting("articlesEnabled");
  }

  if (
    desired.unregisteredUserArticlesAccessibility !== undefined &&
    currentSettings.unregisteredUserArticlesAccessibility !==
      desired.unregisteredUserArticlesAccessibility
  ) {
    await apiClient.api.settingsControllerUpdateArticlesSetting(
      "unregisteredUserArticlesAccessibility",
    );
  }
};

const restoreFeatureSettings = async (
  apiClient: FixtureApiClient,
  originalSettings: GlobalSettings,
) => {
  await setFeatureState(apiClient, {
    QAEnabled: originalSettings.QAEnabled,
    unregisteredUserQAAccessibility: originalSettings.unregisteredUserQAAccessibility,
    newsEnabled: originalSettings.newsEnabled,
    unregisteredUserNewsAccessibility: originalSettings.unregisteredUserNewsAccessibility,
    articlesEnabled: originalSettings.articlesEnabled,
    unregisteredUserArticlesAccessibility: originalSettings.unregisteredUserArticlesAccessibility,
  });
};
