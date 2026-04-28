import { COURSE_LANGUAGE_DIALOG_HANDLES } from "../../data/courses/handles";
import { waitForDialogOverlaysHiddenFlow } from "../common/wait-for-dialog-overlays-hidden.flow";

import type { Page } from "@playwright/test";

export const dismissGenerateMissingTranslationsDialogFlow = async (page: Page) => {
  const generateCancelButton = page.getByTestId(
    COURSE_LANGUAGE_DIALOG_HANDLES.GENERATE_CANCEL_BUTTON,
  );

  if (!(await generateCancelButton.isVisible({ timeout: 10_000 }).catch(() => false))) {
    await waitForDialogOverlaysHiddenFlow(page);
    return;
  }

  await generateCancelButton.click();
  await page.getByTestId(COURSE_LANGUAGE_DIALOG_HANDLES.GENERATE_DIALOG).waitFor({
    state: "hidden",
  });
  await waitForDialogOverlaysHiddenFlow(page);
};
