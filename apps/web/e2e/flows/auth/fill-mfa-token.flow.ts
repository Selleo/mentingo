import { MFA_PAGE_HANDLES } from "../../data/auth/handles";

import type { Page } from "@playwright/test";

export const fillMfaTokenFlow = async (page: Page, token: string) => {
  await page.getByTestId(MFA_PAGE_HANDLES.TOKEN).fill(token);
};
