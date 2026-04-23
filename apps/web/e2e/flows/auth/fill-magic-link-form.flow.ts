import { MAGIC_LINK_PAGE_HANDLES } from "../../data/auth/handles";

import type { Page } from "@playwright/test";

export const fillMagicLinkFormFlow = async (page: Page, email: string) => {
  await page.getByTestId(MAGIC_LINK_PAGE_HANDLES.EMAIL).fill(email);
};
