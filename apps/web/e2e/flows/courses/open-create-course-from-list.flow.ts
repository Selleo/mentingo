import {
  COURSE_TYPE_SELECTOR_HANDLES,
  CREATE_COURSE_PAGE_HANDLES,
  COURSES_PAGE_HANDLES,
} from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const openCreateCourseFromListFlow = async (page: Page) => {
  await page.getByTestId(COURSES_PAGE_HANDLES.CREATE_BUTTON).click();
  await page.getByTestId(COURSE_TYPE_SELECTOR_HANDLES.PAGE).waitFor();
  await page.getByTestId(COURSE_TYPE_SELECTOR_HANDLES.STANDARD_CARD).click();
  await page.getByTestId(CREATE_COURSE_PAGE_HANDLES.PAGE).waitFor();
};
