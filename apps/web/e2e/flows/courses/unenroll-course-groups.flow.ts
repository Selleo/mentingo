import { COURSE_ENROLLED_HANDLES } from "../../data/courses/handles";
import { waitForDialogOverlaysHiddenFlow } from "../common/wait-for-dialog-overlays-hidden.flow";

import type { Page } from "@playwright/test";

export const unenrollCourseGroupsFlow = async (page: Page, groupIds: string[]) => {
  await page.getByTestId(COURSE_ENROLLED_HANDLES.GROUP_ACTIONS_TRIGGER).click();
  await page.getByTestId(COURSE_ENROLLED_HANDLES.GROUP_UNENROLL_ACTION).click();
  await page.getByTestId(COURSE_ENROLLED_HANDLES.GROUP_UNENROLL_DIALOG).waitFor();

  for (const groupId of groupIds) {
    await page.getByTestId(COURSE_ENROLLED_HANDLES.groupUnenrollCheckbox(groupId)).click();
  }

  await page.getByTestId(COURSE_ENROLLED_HANDLES.GROUP_UNENROLL_SUBMIT_BUTTON).click();
  await waitForDialogOverlaysHiddenFlow(page);
};
