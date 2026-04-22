import { LOGIN_PAGE_HANDLES } from "../../data/auth/handles";

import type { Page } from "@playwright/test";

export const submitLoginFormFlow = async (page: Page) => {
  await page.getByTestId(LOGIN_PAGE_HANDLES.LOGIN).click();
};
