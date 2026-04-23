import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const transferCourseOwnershipFlow = async (page: Page, userId: string) => {
  await page.getByTestId(COURSE_OVERVIEW_HANDLES.AUTHOR_TRANSFER_BUTTON).click();
  await page.getByTestId(COURSE_OVERVIEW_HANDLES.transferOwnershipOption(userId)).click();
};
