import { REPORTS_HANDLES } from "../../data/reports/handles";

import type { Page } from "@playwright/test";

export const exportReportSpreadsheetFlow = async (page: Page) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId(REPORTS_HANDLES.EXPORT_SPREADSHEET).click();

  return downloadPromise;
};
