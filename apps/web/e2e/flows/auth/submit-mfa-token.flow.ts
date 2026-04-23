import { MFA_PAGE_HANDLES } from "../../data/auth/handles";

import type { Page } from "@playwright/test";

export const submitMfaTokenFlow = async (page: Page) => {
  await page.getByTestId(MFA_PAGE_HANDLES.SUBMIT).click();
};
