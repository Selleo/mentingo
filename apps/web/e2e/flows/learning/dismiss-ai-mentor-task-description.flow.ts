import { expect, type Page } from "@playwright/test";

import { LEARNING_HANDLES } from "../../data/learning/handles";
import { waitForDialogOverlaysHiddenFlow } from "../common/wait-for-dialog-overlays-hidden.flow";

/** Closes the task description that auto-opens on an unfinished, unevaluated AI mentor lesson. */
export const dismissAiMentorTaskDescriptionFlow = async (page: Page) => {
  const taskDescriptionDialog = page.getByTestId(
    LEARNING_HANDLES.AI_MENTOR_TASK_DESCRIPTION_DIALOG,
  );

  await expect(taskDescriptionDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(taskDescriptionDialog).toBeHidden();
  await waitForDialogOverlaysHiddenFlow(page);
};
