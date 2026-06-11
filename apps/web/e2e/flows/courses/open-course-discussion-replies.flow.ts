import { COURSE_DISCUSSION_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const openCourseDiscussionRepliesFlow = async (page: Page, messageId: string) => {
  await page.getByTestId(COURSE_DISCUSSION_HANDLES.repliesToggle(messageId)).click();
};
