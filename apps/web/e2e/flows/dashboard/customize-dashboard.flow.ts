import { DASHBOARD_EDIT_HANDLES } from "../../data/dashboard/handles";

import type { Page } from "@playwright/test";

export const openWidgetPickerFlow = async (page: Page) => {
  await page.getByTestId(DASHBOARD_EDIT_HANDLES.CUSTOMIZE).click();
  await page.getByTestId(DASHBOARD_EDIT_HANDLES.OPEN_WIDGET_PICKER).click();
};

export const restoreDashboardDefaultFlow = async (page: Page) => {
  await page.getByTestId(DASHBOARD_EDIT_HANDLES.RESTORE_DEFAULT).click();
  await page.getByTestId(DASHBOARD_EDIT_HANDLES.RESTORE_DEFAULT_CONFIRM).click();
};

export const closeWidgetPickerFlow = async (page: Page) => {
  await page.getByTestId(DASHBOARD_EDIT_HANDLES.WIDGET_PICKER_CLOSE).click();
  await page.getByTestId(DASHBOARD_EDIT_HANDLES.FINISH_EDITING).click();
};
