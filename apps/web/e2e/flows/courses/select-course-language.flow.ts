import { EDIT_COURSE_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const selectCourseLanguageFlow = async (
  page: Page,
  language: "en" | "pl" | "de" | "lt" | "cs",
) => {
  await page.getByTestId(EDIT_COURSE_PAGE_HANDLES.LANGUAGE_SELECT).click();
  await page.getByTestId(EDIT_COURSE_PAGE_HANDLES.languageOption(language)).click();
};
