import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";

import type { Page } from "@playwright/test";
import type { LoginMethod } from "@repo/shared";

export const toggleLoginMethodFlow = async (page: Page, method: LoginMethod) => {
  await page.getByTestId(SETTINGS_PAGE_HANDLES.loginMethodSwitch(method)).click();
};
