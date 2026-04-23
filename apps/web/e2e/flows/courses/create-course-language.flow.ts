import {
  COURSE_LANGUAGE_DIALOG_HANDLES,
  EDIT_COURSE_PAGE_HANDLES,
} from "../../data/courses/handles";
import { waitForDialogOverlaysHiddenFlow } from "../common/wait-for-dialog-overlays-hidden.flow";

import { dismissGenerateMissingTranslationsDialogFlow } from "./dismiss-generate-missing-translations-dialog.flow";

import type { Page } from "@playwright/test";
import type { SupportedLanguages } from "@repo/shared";

export const createCourseLanguageFlow = async (page: Page, language: SupportedLanguages) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    await waitForDialogOverlaysHiddenFlow(page);
    await page.getByTestId(EDIT_COURSE_PAGE_HANDLES.LANGUAGE_SELECT).click();

    const option = page.getByTestId(EDIT_COURSE_PAGE_HANDLES.languageOption(language));
    await option.waitFor();

    try {
      await option.click();
      break;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }

  await page.getByTestId(COURSE_LANGUAGE_DIALOG_HANDLES.CREATE_DIALOG).waitFor();
  await page.getByTestId(COURSE_LANGUAGE_DIALOG_HANDLES.CREATE_CONFIRM_BUTTON).click();
  await dismissGenerateMissingTranslationsDialogFlow(page);
  await waitForDialogOverlaysHiddenFlow(page);
};
