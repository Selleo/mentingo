import { USER_ROLE } from "~/config/userRoles";
import { COURSE_LIST_LAYOUT_VARIANT } from "~/modules/Dashboard/Settings/components/admin/courseListLayout";

import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openFeaturesSettingsFlow } from "../../flows/settings/open-features-settings.flow";
import { togglePlatformFeatureFlow } from "../../flows/settings/toggle-platform-feature.flow";

import type { FixtureApiClient } from "../../utils/api-client";

const getGlobalSettings = async (apiClient: FixtureApiClient) => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();

  return response.data.data;
};

test("admin can toggle course platform settings", async ({
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

      if (currentSettings.courseDiscussionsEnabled !== originalSettings.courseDiscussionsEnabled) {
        await apiClient.api.settingsControllerUpdateCourseDiscussionsEnabled();
      }
    });

    await openFeaturesSettingsFlow(page);
    await togglePlatformFeatureFlow(page, SETTINGS_PAGE_HANDLES.COURSES_VISIBILITY_SWITCH);
    await togglePlatformFeatureFlow(page, SETTINGS_PAGE_HANDLES.COURSE_DISCUSSIONS_SWITCH);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB).click();
    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_CONTENT),
    ).toBeVisible();

    const nextCourseListLayout = originalSettings.modernCourseListEnabled
      ? COURSE_LIST_LAYOUT_VARIANT.CLASSIC
      : COURSE_LIST_LAYOUT_VARIANT.MODERN;

    await page
      .getByTestId(SETTINGS_PAGE_HANDLES.courseListLayoutOption(nextCourseListLayout))
      .click();

    await expect
      .poll(async () => {
        const settings = await getGlobalSettings(apiClient);

        return {
          courseDiscussionsEnabled: settings.courseDiscussionsEnabled,
          modernCourseListEnabled: settings.modernCourseListEnabled,
          unregisteredUserCoursesAccessibility: settings.unregisteredUserCoursesAccessibility,
        };
      })
      .toEqual({
        courseDiscussionsEnabled: !originalSettings.courseDiscussionsEnabled,
        modernCourseListEnabled: !originalSettings.modernCourseListEnabled,
        unregisteredUserCoursesAccessibility:
          !originalSettings.unregisteredUserCoursesAccessibility,
      });
  });
});
