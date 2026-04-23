import { PASSWORD_RECOVERY_PAGE_HANDLES } from "../../data/auth/handles";

import type { Page } from "@playwright/test";

export const submitPasswordRecoveryFormFlow = async (page: Page) => {
  await page.getByTestId(PASSWORD_RECOVERY_PAGE_HANDLES.SUBMIT).click();
};
