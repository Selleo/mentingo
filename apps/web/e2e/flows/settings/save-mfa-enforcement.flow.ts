import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";

import type { Page } from "@playwright/test";

export const saveMfaEnforcementFlow = async (page: Page) => {
  await page.getByTestId(SETTINGS_PAGE_HANDLES.MFA_ENFORCEMENT_SAVE).click();
};
