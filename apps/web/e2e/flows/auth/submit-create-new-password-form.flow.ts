import { CREATE_NEW_PASSWORD_PAGE_HANDLES } from "../../data/auth/handles";

import type { Page } from "@playwright/test";

export const submitCreateNewPasswordFormFlow = async (page: Page) => {
  await page.getByTestId(CREATE_NEW_PASSWORD_PAGE_HANDLES.SUBMIT).click();
};
