import { REPORTS_HANDLES } from "../../data/reports/handles";

import type { Page } from "@playwright/test";

export const openSavedReportConfigurationsFlow = async (page: Page) => {
  await page.getByTestId(REPORTS_HANDLES.SAVED_CONFIGURATIONS).click();
};

export const saveReportConfigurationFlow = async (page: Page, name: string) => {
  await openSavedReportConfigurationsFlow(page);
  await page.getByTestId(REPORTS_HANDLES.SAVE_CONFIGURATION).click();
  await page.getByTestId(REPORTS_HANDLES.SAVE_NAME_INPUT).fill(name);
  await page.getByTestId(REPORTS_HANDLES.SAVE_SUBMIT).click();
};
