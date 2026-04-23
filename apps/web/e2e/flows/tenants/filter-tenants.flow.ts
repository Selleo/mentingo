import { TENANTS_PAGE_HANDLES } from "../../data/tenants/handles";

import type { Page } from "@playwright/test";

export const filterTenantsFlow = async (page: Page, search: string) => {
  await page.getByTestId(TENANTS_PAGE_HANDLES.SEARCH_INPUT).fill(search);
};
