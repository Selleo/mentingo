import { COURSE_ENROLLED_HANDLES, COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";
import { openCourseOverviewFlow } from "../learning/open-course-overview.flow";

import type { Page } from "@playwright/test";

export const openCourseEnrolledTabFlow = async (page: Page, courseId: string) => {
  await openCourseOverviewFlow(page, courseId);
  await page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO).waitFor();
  await page.getByTestId(COURSE_OVERVIEW_HANDLES.SETTINGS_BUTTON).click();
  await page.getByTestId(COURSE_OVERVIEW_HANDLES.SETTINGS_DRAWER).waitFor();
  await page.getByTestId(COURSE_OVERVIEW_HANDLES.settingsTab("enrolled")).click();
  await page.getByTestId(COURSE_ENROLLED_HANDLES.ROOT).waitFor();
};
