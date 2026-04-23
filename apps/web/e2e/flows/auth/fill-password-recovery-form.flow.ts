import { PASSWORD_RECOVERY_PAGE_HANDLES } from "../../data/auth/handles";

import type { Page } from "@playwright/test";

export const fillPasswordRecoveryFormFlow = async (page: Page, email: string) => {
  await page.getByTestId(PASSWORD_RECOVERY_PAGE_HANDLES.EMAIL).fill(email);
};
