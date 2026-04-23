import { COURSE_STATUS_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const selectCourseStatusFlow = async (
  page: Page,
  status: "draft" | "private" | "published",
) => {
  await page.getByTestId(COURSE_STATUS_HANDLES.statusCard(status)).click();
};
