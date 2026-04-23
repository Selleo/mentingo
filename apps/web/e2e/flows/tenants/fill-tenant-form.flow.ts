import { TENANT_FORM_HANDLES } from "../../data/tenants/handles";

import type { Page } from "@playwright/test";

type FillTenantFormFlowInput = {
  name?: string;
  host?: string;
  status?: "active" | "inactive";
  adminFirstName?: string;
  adminLastName?: string;
  adminEmail?: string;
};

export const fillTenantFormFlow = async (page: Page, input: FillTenantFormFlowInput) => {
  if (input.name !== undefined) {
    await page.getByTestId(TENANT_FORM_HANDLES.NAME_INPUT).fill(input.name);
  }

  if (input.host !== undefined) {
    await page.getByTestId(TENANT_FORM_HANDLES.HOST_INPUT).fill(input.host);
  }

  if (input.status !== undefined) {
    await page.getByTestId(TENANT_FORM_HANDLES.STATUS_SELECT).click();
    await page.getByTestId(TENANT_FORM_HANDLES.statusOption(input.status)).click();
  }

  if (input.adminFirstName !== undefined) {
    await page.getByTestId(TENANT_FORM_HANDLES.ADMIN_FIRST_NAME_INPUT).fill(input.adminFirstName);
  }

  if (input.adminLastName !== undefined) {
    await page.getByTestId(TENANT_FORM_HANDLES.ADMIN_LAST_NAME_INPUT).fill(input.adminLastName);
  }

  if (input.adminEmail !== undefined) {
    await page.getByTestId(TENANT_FORM_HANDLES.ADMIN_EMAIL_INPUT).fill(input.adminEmail);
  }
};
