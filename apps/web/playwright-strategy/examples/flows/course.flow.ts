import type { Page } from "@playwright/test";

export const courseFlow = {
  async openEditor(page: Page, courseId: string): Promise<void> {
    await page.goto(`/admin/beta-courses/${courseId}`);
  },

  async updatePricing(page: Page, mode: "free" | "paid"): Promise<void> {
    await page.getByTestId(`course-pricing-${mode}`).click();
    await page.getByTestId("course-save-button").click();
  },
};
