import type { Page } from "@playwright/test";

export const openDashboardFlow = async (page: Page, origin?: string) => {
  await page.goto(origin ? new URL("/dashboard", origin).toString() : "/dashboard");
  await page.waitForLoadState("networkidle");
};
