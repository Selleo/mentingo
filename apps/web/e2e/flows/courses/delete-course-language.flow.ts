import {
  COURSE_LANGUAGE_DIALOG_HANDLES,
  EDIT_COURSE_PAGE_HANDLES,
} from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const deleteCourseLanguageFlow = async (page: Page) => {
  await page.getByTestId(EDIT_COURSE_PAGE_HANDLES.DELETE_LANGUAGE_BUTTON).click();
  await page.getByTestId(COURSE_LANGUAGE_DIALOG_HANDLES.DELETE_DIALOG).waitFor();
  await page.getByTestId(COURSE_LANGUAGE_DIALOG_HANDLES.DELETE_CONFIRM_BUTTON).click();
};
