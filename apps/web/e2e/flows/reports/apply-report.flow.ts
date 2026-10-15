import { REPORTS_HANDLES } from "../../data/reports/handles";

import type { Page } from "@playwright/test";

export const applyReportFlow = async (page: Page) => {
  await page.getByTestId(REPORTS_HANDLES.APPLY).click();
};
