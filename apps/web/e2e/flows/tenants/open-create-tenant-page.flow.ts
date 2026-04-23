import { CREATE_TENANT_PAGE_HANDLES } from "../../data/tenants/handles";

import type { Page } from "@playwright/test";

export const openCreateTenantPageFlow = async (page: Page) => {
  await page.goto("/super-admin/tenants/new");
  await page.getByTestId(CREATE_TENANT_PAGE_HANDLES.PAGE).waitFor();
};
