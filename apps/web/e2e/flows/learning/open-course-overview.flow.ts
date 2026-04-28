import type { Page } from "@playwright/test";

export const openCourseOverviewFlow = async (page: Page, courseIdOrSlug: string) => {
  await page.goto(`/course/${courseIdOrSlug}`);
};
