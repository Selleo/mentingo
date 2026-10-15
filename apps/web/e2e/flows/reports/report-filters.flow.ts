import { REPORTS_HANDLES } from "../../data/reports/handles";

import type { Page } from "@playwright/test";

export const openReportFiltersFlow = async (page: Page) => {
  await page.getByTestId(REPORTS_HANDLES.FILTERS_TOGGLE).click();
};

export const addReportConditionFlow = async (page: Page) => {
  await page.getByTestId(REPORTS_HANDLES.ADD_CONDITION).click();
};

export const removeReportConditionFlow = async (page: Page) => {
  await page.getByRole("button", { name: "Remove condition" }).first().click();
};

export const resetReportFlow = async (page: Page) => {
  await page.getByTestId(REPORTS_HANDLES.RESET_ALL).click();
};
