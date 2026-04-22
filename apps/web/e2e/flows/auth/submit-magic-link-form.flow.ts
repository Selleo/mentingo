import { MAGIC_LINK_PAGE_HANDLES } from "../../data/auth/handles";

import type { Page } from "@playwright/test";

export const submitMagicLinkFormFlow = async (page: Page) => {
  await page.getByTestId(MAGIC_LINK_PAGE_HANDLES.SUBMIT).click();
};
