import { expect, type Page } from "@playwright/test";

import { LEARNING_HANDLES } from "../../data/learning/handles";
import { waitForDialogOverlaysHiddenFlow } from "../common/wait-for-dialog-overlays-hidden.flow";

export const dismissAiMentorTaskDescriptionFlow = async (
  page: Page,
  options: { timeout?: number } = {},
) => {
  const { timeout = 10_000 } = options;
  const taskDescriptionDialog = page.getByTestId(
    LEARNING_HANDLES.AI_MENTOR_TASK_DESCRIPTION_DIALOG,
  );

  const isTaskDescriptionDialogVisible = await taskDescriptionDialog
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);

  if (!isTaskDescriptionDialogVisible) {
    await waitForDialogOverlaysHiddenFlow(page);
    return;
  }

  await page.keyboard.press("Escape");
  await expect(taskDescriptionDialog).toBeHidden();
  await waitForDialogOverlaysHiddenFlow(page);
};
