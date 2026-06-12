import { COURSE_DISCUSSION_HANDLES } from "../../data/courses/handles";
import { openCourseOverviewFlow } from "../learning/open-course-overview.flow";

import type { Page } from "@playwright/test";

export const openCourseDiscussionFlow = async (page: Page, courseIdOrSlug: string) => {
  await openCourseOverviewFlow(page, courseIdOrSlug);
  await page.getByTestId(COURSE_DISCUSSION_HANDLES.TAB).click();
};
