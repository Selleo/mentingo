import { COURSE_DISCUSSION_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const reactToCourseDiscussionMessageFlow = async (
  page: Page,
  messageId: string,
  reaction: string,
) => {
  await page.getByTestId(COURSE_DISCUSSION_HANDLES.message(messageId)).hover();
  await page
    .getByTestId(COURSE_DISCUSSION_HANDLES.messageReactionAction(messageId, reaction))
    .click();
};
