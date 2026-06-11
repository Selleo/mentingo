import type { Page } from "@playwright/test";

export const openCourseOverviewFlow = async (page: Page, courseIdOrSlug: string) => {
  const path = `/course/${courseIdOrSlug}`;
  const currentUrl = page.url();

  await page.goto(currentUrl === "about:blank" ? path : new URL(path, currentUrl).toString());
};
