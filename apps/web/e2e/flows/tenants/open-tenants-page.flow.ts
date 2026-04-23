import { TENANTS_PAGE_HANDLES } from "../../data/tenants/handles";

import type { Page } from "@playwright/test";

export const openTenantsPageFlow = async (page: Page) => {
  await page.goto("/super-admin/tenants");
  await page.getByTestId(TENANTS_PAGE_HANDLES.PAGE).waitFor();
};
