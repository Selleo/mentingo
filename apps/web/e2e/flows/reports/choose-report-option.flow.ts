import type { Locator, Page } from "@playwright/test";

export const chooseReportOptionFlow = async (page: Page, combobox: Locator, option: string) => {
  await combobox.click();
  await page.getByRole("option", { name: option, exact: true }).click();
};
