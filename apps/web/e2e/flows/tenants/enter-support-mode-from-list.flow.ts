import { TENANTS_PAGE_HANDLES } from "../../data/tenants/handles";

import type { Page } from "@playwright/test";

export const enterSupportModeFromListFlow = async (page: Page, tenantId: string) => {
  await page.getByTestId(TENANTS_PAGE_HANDLES.supportModeButton(tenantId)).click();
  await page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_POPOVER).waitFor();
  await page
    .locator(`[data-testid^="${TENANTS_PAGE_HANDLES.SUPPORT_MODE_USER_OPTION_PREFIX}"]`)
    .first()
    .click();
  await page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_SUBMIT).click();
};
