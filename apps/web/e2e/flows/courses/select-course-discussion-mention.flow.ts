import { COURSE_DISCUSSION_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const selectCourseDiscussionMentionFlow = async (
  page: Page,
  query: string,
  userId: string,
) => {
  await page.getByTestId(COURSE_DISCUSSION_HANDLES.THREAD_INPUT).fill(`@${query}`);
  await page.getByTestId(COURSE_DISCUSSION_HANDLES.threadMentionOption(userId)).click();
};
