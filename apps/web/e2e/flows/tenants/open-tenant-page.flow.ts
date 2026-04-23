import { TENANT_PAGE_HANDLES } from "../../data/tenants/handles";

import type { Page } from "@playwright/test";

export const openTenantPageFlow = async (page: Page, tenantId: string) => {
  await page.goto(`/super-admin/tenants/${tenantId}`);
  await page.getByTestId(TENANT_PAGE_HANDLES.PAGE).waitFor();
};
