import type { Page } from "@playwright/test";

export const openCourseOverviewFlow = async (page: Page, courseIdOrSlug: string) => {
  const path = `/course/${courseIdOrSlug}`;
  const currentUrl = page.url();

  await page.goto(currentUrl === "about:blank" ? path : new URL(path, currentUrl).toString());

  const isCourseId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      courseIdOrSlug,
    );

  if (isCourseId) {
    await page.waitForURL((url) => url.pathname.startsWith("/course/") && url.pathname !== path);
  }
};
