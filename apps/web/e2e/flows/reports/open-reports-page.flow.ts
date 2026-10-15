import type { Page } from "@playwright/test";

export const openReportsPageFlow = async (page: Page) => {
  await page.goto("/reports");
};
