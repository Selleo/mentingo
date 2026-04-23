import { CREATE_TENANT_PAGE_HANDLES, TENANTS_PAGE_HANDLES } from "../../data/tenants/handles";

import type { Page } from "@playwright/test";

export const openCreateTenantFromListFlow = async (page: Page) => {
  await page.getByTestId(TENANTS_PAGE_HANDLES.CREATE_BUTTON).click();
  await page.getByTestId(CREATE_TENANT_PAGE_HANDLES.PAGE).waitFor();
};
