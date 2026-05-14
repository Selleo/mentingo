import {
  COURSE_TYPE_SELECTOR_HANDLES,
  CREATE_SCORM_COURSE_PAGE_HANDLES,
} from "../../data/courses/handles";

import { openCreateCourseTypeSelectorFlow } from "./open-create-course-type-selector.flow";

import type { Page } from "@playwright/test";

export const openCreateScormCoursePageFlow = async (page: Page) => {
  await openCreateCourseTypeSelectorFlow(page);
  await page.getByTestId(COURSE_TYPE_SELECTOR_HANDLES.SCORM_CARD).click();
  await page.getByTestId(CREATE_SCORM_COURSE_PAGE_HANDLES.PAGE).waitFor();
};
