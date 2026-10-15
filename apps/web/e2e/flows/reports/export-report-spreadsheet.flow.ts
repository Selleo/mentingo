import type { Page } from "@playwright/test";

export const exportReportSpreadsheetFlow = async (page: Page) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export spreadsheet" }).click();

  return downloadPromise;
};
