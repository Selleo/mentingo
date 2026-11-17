import { getGlobalSettings } from "./global-settings";

import type { FixtureApiClient } from "./api-client";

type CourseSettings = {
  unregisteredUserCoursesAccessibility: boolean;
  modernCourseListEnabled: boolean;
  courseDiscussionsEnabled: boolean;
};

/** The endpoints are toggles, so each one is called only when the state differs. */
export const setCourseSettings = async (apiClient: FixtureApiClient, target: CourseSettings) => {
  const current = await getGlobalSettings(apiClient);

  if (
    current.unregisteredUserCoursesAccessibility !== target.unregisteredUserCoursesAccessibility
  ) {
    await apiClient.api.settingsControllerUpdateUnregisteredUserCoursesAccessibility();
  }
  if (current.modernCourseListEnabled !== target.modernCourseListEnabled) {
    await apiClient.api.settingsControllerUpdateModernCourseListEnabled();
  }
  if (current.courseDiscussionsEnabled !== target.courseDiscussionsEnabled) {
    await apiClient.api.settingsControllerUpdateCourseDiscussionsEnabled();
  }
};
