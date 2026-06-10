import { COURSE_LANGUAGE_DIALOG_HANDLES } from "../../data/courses/handles";
import { waitForDialogOverlaysHiddenFlow } from "../common/wait-for-dialog-overlays-hidden.flow";

import type { Page } from "@playwright/test";

export const dismissGenerateMissingTranslationsDialogFlow = async (
  page: Page,
  options: { timeout?: number } = {},
) => {
  const { timeout = 10_000 } = options;

  const generateDialog = page.getByTestId(COURSE_LANGUAGE_DIALOG_HANDLES.GENERATE_DIALOG);
  const generateCancelButton = page.getByTestId(
    COURSE_LANGUAGE_DIALOG_HANDLES.GENERATE_CANCEL_BUTTON,
  );

  const isGenerateDialogVisible = await generateDialog
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);

  if (!isGenerateDialogVisible) {
    await waitForDialogOverlaysHiddenFlow(page);
    return;
  }

  await generateCancelButton.click();
  await generateDialog.waitFor({ state: "hidden" });
  await waitForDialogOverlaysHiddenFlow(page);
};
