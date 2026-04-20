import { CREATE_USER_PAGE_HANDLES } from "../../data/users/handles";

import type { Page } from "@playwright/test";

export const submitCreateUserFormFlow = async (page: Page) => {
  await page.getByTestId(CREATE_USER_PAGE_HANDLES.SUBMIT_BUTTON).click();
};
