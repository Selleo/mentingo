import { expect, type Page } from "@playwright/test";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { SETTINGS_PAGE_SELECTORS } from "../../data/settings/handles";
import { clickHandleAndExpectUrlFlow } from "../click-handle-and-expect-url.flow";
import { prepareNavigationPageFlow } from "../navigation/prepare-navigation-page.flow";

export const openSettingsPageFlow = async (page: Page) => {
  await prepareNavigationPageFlow(page);
  await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
  await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.SETTINGS_LINK, "/settings");
  await expect(page.locator(SETTINGS_PAGE_SELECTORS.PAGE)).toBeVisible();
  await expect(page.locator(SETTINGS_PAGE_SELECTORS.LANGUAGE_CARD)).toBeVisible();
};
