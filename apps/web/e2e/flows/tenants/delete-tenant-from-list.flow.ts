import { expect, type Page } from "@playwright/test";

import { TENANTS_PAGE_HANDLES } from "../../data/tenants/handles";

export const deleteTenantFromListFlow = async (page: Page, tenantId: string) => {
  await page.getByTestId(TENANTS_PAGE_HANDLES.actionsMenuButton(tenantId)).click();
  await page.getByTestId(TENANTS_PAGE_HANDLES.deleteButton(tenantId)).click();
  await expect(page.getByTestId(TENANTS_PAGE_HANDLES.DELETE_DIALOG)).toBeVisible();
  await page.getByTestId(TENANTS_PAGE_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON).click();
};
