import { CALENDAR_HANDLES } from "../../data/live-training/handles";
import { expect } from "../../fixtures/test.fixture";

import type { Page } from "@playwright/test";

export const openCalendarFlow = async (page: Page) => {
  await page.goto("/calendar");
  await expect(page.getByTestId(CALENDAR_HANDLES.PAGE)).toBeVisible();
};
