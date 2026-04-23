import { REGISTER_PAGE_HANDLES } from "../../data/auth/handles";

import type { Page } from "@playwright/test";

export const submitRegisterFormFlow = async (page: Page) => {
  await page.getByTestId(REGISTER_PAGE_HANDLES.SUBMIT).click();
};
