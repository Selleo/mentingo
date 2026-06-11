import { COURSE_DISCUSSION_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const deleteCourseDiscussionMessageFlow = async (page: Page, messageId: string) => {
  await page.getByTestId(COURSE_DISCUSSION_HANDLES.message(messageId)).hover();
  await page.getByTestId(COURSE_DISCUSSION_HANDLES.messageDeleteAction(messageId)).click();
  await page.getByTestId(COURSE_DISCUSSION_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON).click();
};
