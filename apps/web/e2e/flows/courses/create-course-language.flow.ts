import {
  COURSE_LANGUAGE_DIALOG_HANDLES,
  EDIT_COURSE_PAGE_HANDLES,
} from "../../data/courses/handles";

import type { Page } from "@playwright/test";
import type { SupportedLanguages } from "@repo/shared";

export const createCourseLanguageFlow = async (page: Page, language: SupportedLanguages) => {
  await page.getByTestId(EDIT_COURSE_PAGE_HANDLES.LANGUAGE_SELECT).click();
  await page.getByTestId(EDIT_COURSE_PAGE_HANDLES.languageOption(language)).click();
  await page.getByTestId(COURSE_LANGUAGE_DIALOG_HANDLES.CREATE_DIALOG).waitFor();
  await page.getByTestId(COURSE_LANGUAGE_DIALOG_HANDLES.CREATE_CONFIRM_BUTTON).click();

  const generateCancelButton = page.getByTestId(
    COURSE_LANGUAGE_DIALOG_HANDLES.GENERATE_CANCEL_BUTTON,
  );
  if (await generateCancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.getByTestId(COURSE_LANGUAGE_DIALOG_HANDLES.GENERATE_CANCEL_BUTTON).click();
  }
};
