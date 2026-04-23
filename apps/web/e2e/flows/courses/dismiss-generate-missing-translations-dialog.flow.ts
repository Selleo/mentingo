import { COURSE_LANGUAGE_DIALOG_HANDLES } from "../../data/courses/handles";
import { waitForDialogOverlaysHiddenFlow } from "../common/wait-for-dialog-overlays-hidden.flow";

import type { Page } from "@playwright/test";

export const dismissGenerateMissingTranslationsDialogFlow = async (page: Page) => {
  const generateDialog = page.getByTestId(COURSE_LANGUAGE_DIALOG_HANDLES.GENERATE_DIALOG);

  if (!(await generateDialog.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return;
  }

  await page.getByTestId(COURSE_LANGUAGE_DIALOG_HANDLES.GENERATE_CANCEL_BUTTON).click();
  await generateDialog.waitFor({ state: "hidden" });
  await waitForDialogOverlaysHiddenFlow(page);
};
