import { CALENDAR_HANDLES } from "../../data/live-training/handles";
import { expect } from "../../fixtures/test.fixture";

import type { Page } from "@playwright/test";

export const openCalendarCreateLiveTrainingDialogFlow = async (page: Page, date: string) => {
  const dayCell = page
    .getByTestId(CALENDAR_HANDLES.dayCell(date))
    .or(page.locator(`.fc-daygrid-day[data-date="${date}"]`))
    .first();

  await dayCell.click();
  await expect(page.getByTestId(CALENDAR_HANDLES.CREATE_DIALOG)).toBeVisible();
  await page.getByTestId(CALENDAR_HANDLES.CREATE_LIVE_TRAINING_OPTION).click();
};
