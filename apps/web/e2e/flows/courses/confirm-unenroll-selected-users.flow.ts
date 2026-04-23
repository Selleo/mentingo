import { expect } from "@playwright/test";

import { COURSE_ENROLLED_HANDLES } from "../../data/courses/handles";
import { waitForDialogOverlaysHiddenFlow } from "../common/wait-for-dialog-overlays-hidden.flow";

import type { Page } from "@playwright/test";

export const confirmUnenrollSelectedUsersFlow = async (page: Page) => {
  const trigger = page.getByTestId(COURSE_ENROLLED_HANDLES.USER_ACTIONS_TRIGGER);

  await expect(trigger).toBeEnabled();
  await trigger.click();
  await page.getByTestId(COURSE_ENROLLED_HANDLES.USER_UNENROLL_SELECTED_ACTION).click();
  await page.getByTestId(COURSE_ENROLLED_HANDLES.USER_UNENROLL_DIALOG).waitFor();
  await page.getByTestId(COURSE_ENROLLED_HANDLES.USER_UNENROLL_CONFIRM_BUTTON).click();
  await waitForDialogOverlaysHiddenFlow(page);
};
