import { expect, type Page } from "@playwright/test";

import { TENANTS_PAGE_HANDLES } from "../../data/tenants/handles";

export const enterSupportModeFromListFlow = async (page: Page, tenantId: string) => {
  const tenantRow = page.getByTestId(TENANTS_PAGE_HANDLES.row(tenantId));

  await expect(tenantRow).toBeVisible();
  await tenantRow.getByTestId(TENANTS_PAGE_HANDLES.supportModeButton(tenantId)).click();
  await page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_POPOVER).waitFor();
  const userOption = page
    .locator(`[data-testid^="${TENANTS_PAGE_HANDLES.SUPPORT_MODE_USER_OPTION_PREFIX}"]`)
    .first();

  await expect(userOption).toBeVisible();
  await userOption.click({ force: true });
  await page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_SUBMIT).click();
};
