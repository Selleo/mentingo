import { expect, type Page } from "@playwright/test";

import { EMAIL_TEMPLATES_HANDLES } from "../../data/email-templates/handles";

export const openEmailTemplatesPageFlow = async (page: Page) => {
  await page.goto("/admin/email-templates");
  await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PAGE)).toBeVisible();
};
