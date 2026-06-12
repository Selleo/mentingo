import { COURSE_DISCUSSION_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const submitCourseDiscussionThreadFlow = async (page: Page, content: string) => {
  await page.getByTestId(COURSE_DISCUSSION_HANDLES.THREAD_INPUT).fill(content);
  await page.getByTestId(COURSE_DISCUSSION_HANDLES.THREAD_SEND_BUTTON).click();
};
