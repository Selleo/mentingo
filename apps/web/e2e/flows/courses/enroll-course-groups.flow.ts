import { COURSE_ENROLLED_HANDLES } from "../../data/courses/handles";
import { waitForDialogOverlaysHiddenFlow } from "../common/wait-for-dialog-overlays-hidden.flow";

import type { Page } from "@playwright/test";

export const enrollCourseGroupsFlow = async (page: Page, groupIds: string[]) => {
  await page.getByTestId(COURSE_ENROLLED_HANDLES.GROUP_ACTIONS_TRIGGER).click();
  await page.getByTestId(COURSE_ENROLLED_HANDLES.GROUP_ENROLL_ACTION).click();
  await page.getByTestId(COURSE_ENROLLED_HANDLES.GROUP_ENROLL_DIALOG).waitFor();

  for (const groupId of groupIds) {
    await page.getByTestId(COURSE_ENROLLED_HANDLES.groupEnrollCheckbox(groupId)).click();
  }

  await page.getByTestId(COURSE_ENROLLED_HANDLES.GROUP_ENROLL_SUBMIT_BUTTON).click();
  await waitForDialogOverlaysHiddenFlow(page);
};
