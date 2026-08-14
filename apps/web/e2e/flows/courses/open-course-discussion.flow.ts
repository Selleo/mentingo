import { expect, type Page } from "@playwright/test";

import { COURSE_DISCUSSION_HANDLES } from "../../data/courses/handles";
import { openCourseOverviewFlow } from "../learning/open-course-overview.flow";

export const openCourseDiscussionFlow = async (page: Page, courseIdOrSlug: string) => {
  await openCourseOverviewFlow(page, courseIdOrSlug);
  const messagesResponse = page.waitForResponse((response) => {
    const pathname = new URL(response.url()).pathname;

    return (
      response.request().method() === "GET" &&
      pathname.startsWith("/api/course-chat/") &&
      pathname.endsWith("/messages")
    );
  });

  await page.getByTestId(COURSE_DISCUSSION_HANDLES.TAB).click();
  await messagesResponse;
  await expect(page.getByTestId(COURSE_DISCUSSION_HANDLES.ROOT)).toBeVisible();
};
