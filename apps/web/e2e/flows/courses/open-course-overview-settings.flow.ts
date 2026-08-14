import { COURSE_OVERVIEW_HANDLES, COURSE_TAB_VALUES } from "../../data/courses/handles";
import { openCourseOverviewFlow } from "../learning/open-course-overview.flow";

import type { Page } from "@playwright/test";

export const openCourseOverviewSettingsFlow = async (page: Page, courseIdOrSlug: string) => {
  await openCourseOverviewFlow(page, courseIdOrSlug);
  await page.getByTestId(COURSE_OVERVIEW_HANDLES.SETTINGS_BUTTON).click();
  await page.getByTestId(COURSE_OVERVIEW_HANDLES.SETTINGS_DRAWER).waitFor();
};

export const selectCourseOverviewSettingsTabFlow = async (page: Page, tab: string) => {
  const settingsTabValues: Record<string, string> = {
    [COURSE_TAB_VALUES.STATUS]: "status",
    [COURSE_TAB_VALUES.PRICING]: "pricing",
    [COURSE_TAB_VALUES.ENROLLED]: "enrolled",
    [COURSE_TAB_VALUES.EXPORTS]: "sharing",
  };

  await page
    .getByTestId(COURSE_OVERVIEW_HANDLES.settingsTab(settingsTabValues[tab] ?? tab))
    .click();
};
