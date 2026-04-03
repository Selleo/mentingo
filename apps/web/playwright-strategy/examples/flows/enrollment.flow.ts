import type { Page } from "@playwright/test";

export const enrollmentFlow = {
  async selfEnroll(page: Page, courseId: string): Promise<void> {
    await page.goto(`/course/${courseId}`);
    await page.getByTestId("course-enroll-button").click();
  },
};
