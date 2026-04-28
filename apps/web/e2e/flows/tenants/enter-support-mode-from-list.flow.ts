import { TENANTS_PAGE_HANDLES } from "../../data/tenants/handles";

import type { Page } from "@playwright/test";

export const enterSupportModeFromListFlow = async (page: Page, tenantId: string) => {
  await page.getByTestId(TENANTS_PAGE_HANDLES.supportModeButton(tenantId)).click();
};
