import { TENANT_FORM_HANDLES } from "../../data/tenants/handles";

import type { Page } from "@playwright/test";

export const submitTenantFormFlow = async (page: Page) => {
  await page.getByTestId(TENANT_FORM_HANDLES.SUBMIT_BUTTON).click();
};
