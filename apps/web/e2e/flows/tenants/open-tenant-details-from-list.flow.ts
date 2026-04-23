import { TENANTS_PAGE_HANDLES, TENANT_PAGE_HANDLES } from "../../data/tenants/handles";

import type { Page } from "@playwright/test";

export const openTenantDetailsFromListFlow = async (page: Page, tenantId: string) => {
  await page.getByTestId(TENANTS_PAGE_HANDLES.editButton(tenantId)).click();
  await page.getByTestId(TENANT_PAGE_HANDLES.PAGE).waitFor();
};
