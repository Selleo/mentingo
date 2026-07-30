import { expect, type Page } from "@playwright/test";

import { EDIT_EMAIL_TEMPLATE_HANDLES } from "../../data/email-templates/handles";

export const openEditEmailTemplatePageFlow = async (page: Page, id: string) => {
  await page.goto(`/admin/email-templates/${id}`);
  await expect(page.getByTestId(EDIT_EMAIL_TEMPLATE_HANDLES.PAGE)).toBeVisible();
};
