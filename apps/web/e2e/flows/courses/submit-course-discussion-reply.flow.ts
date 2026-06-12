import { COURSE_DISCUSSION_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const submitCourseDiscussionReplyFlow = async (
  page: Page,
  messageId: string,
  content: string,
) => {
  await page.getByTestId(COURSE_DISCUSSION_HANDLES.replyInput(messageId)).fill(content);
  await page.getByTestId(COURSE_DISCUSSION_HANDLES.replySendButton(messageId)).click();
};
