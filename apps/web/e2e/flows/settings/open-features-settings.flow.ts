import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect } from "../../fixtures/test.fixture";

import { openSettingsPageFlow } from "./open-settings-page.flow";

import type { Page } from "@playwright/test";

export const openFeaturesSettingsFlow = async (page: Page) => {
  await openSettingsPageFlow(page);
  await page.getByTestId(SETTINGS_PAGE_HANDLES.FEATURES_TAB).click();
  await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.FEATURES_CONTENT)).toBeVisible();
};
