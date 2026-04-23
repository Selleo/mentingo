import { COURSE_TAB_VALUES } from "../../data/courses/handles";
import { CURRICULUM_HANDLES } from "../../data/curriculum/handles";
import { openEditCoursePageFlow } from "../courses/open-edit-course-page.flow";

import type { Page } from "@playwright/test";

export const openCurriculumPageFlow = async (page: Page, courseId: string) => {
  await openEditCoursePageFlow(page, courseId, COURSE_TAB_VALUES.CURRICULUM);
  await page.getByTestId(CURRICULUM_HANDLES.ROOT).waitFor();
};
