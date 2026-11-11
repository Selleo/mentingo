import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";

import type { Page } from "@playwright/test";

export const toggleMfaEnforcementRoleFlow = async (page: Page, role: string) => {
  await page.getByTestId(SETTINGS_PAGE_HANDLES.mfaRoleSwitch(role)).click();
};
