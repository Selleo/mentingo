import { EDIT_COURSE_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";
import type { SupportedLanguages } from "@repo/shared";

export const selectCourseLanguageFlow = async (page: Page, language: SupportedLanguages) => {
  await page.getByTestId(EDIT_COURSE_PAGE_HANDLES.LANGUAGE_SELECT).click();
  await page.getByTestId(EDIT_COURSE_PAGE_HANDLES.languageOption(language)).click();
};
