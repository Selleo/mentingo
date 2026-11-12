import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";

import type { Page } from "@playwright/test";

/** Flips a Features tab switch; turning a feature off also confirms the dialog. */
export const togglePlatformFeatureFlow = async (page: Page, switchTestId: string) => {
  const featureSwitch = page.getByTestId(switchTestId);
  const wasEnabled = (await featureSwitch.getAttribute("data-state")) === "checked";

  await featureSwitch.click();

  if (!wasEnabled) return;

  await page.getByTestId(SETTINGS_PAGE_HANDLES.FEATURE_DISABLE_CONFIRM_BUTTON).click();
  await page.getByTestId(SETTINGS_PAGE_HANDLES.FEATURE_DISABLE_DIALOG).waitFor({ state: "hidden" });
};
