import { USER_ROLE } from "~/config/userRoles";

import { EMAIL_TEMPLATES_HANDLES } from "../../data/email-templates/handles";
import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { EMAIL_TEMPLATE_DATA } from "../../data/test-data/email-template.data";
import { openEmailCatalogFromNavigationFlow } from "../../flows/email-templates/template-actions.flow";

import { expect, test } from "./email-template.fixture";

test("admin opens the system catalog from Manage and cannot edit defaults", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await openEmailCatalogFromNavigationFlow(page);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.TABLE)).toBeVisible();
    await page
      .getByTestId(EMAIL_TEMPLATES_HANDLES.ROW(EMAIL_TEMPLATE_DATA.event))
      .getByRole("link")
      .click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toBeDisabled();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.NAME)).toBeDisabled();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE)).toHaveCount(0);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PUBLISH)).toHaveCount(0);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.DELETE)).toHaveCount(0);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PALETTE_BLOCK("text"))).toBeDisabled();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.EDIT_BLOCK).first()).toBeDisabled();
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.PREVIEW).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PALETTE)).toBeHidden();
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.PREVIEW).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PALETTE_BLOCK("text"))).toBeDisabled();
  });
});

for (const role of [USER_ROLE.student, USER_ROLE.contentCreator]) {
  test(`${role} cannot access template management`, async ({ withReadonlyPage }) => {
    await withReadonlyPage(role, async ({ page }) => {
      for (const route of [
        EMAIL_TEMPLATE_DATA.listPath,
        `${EMAIL_TEMPLATE_DATA.listPath}/defaults/${EMAIL_TEMPLATE_DATA.event}`,
      ]) {
        await page.goto(route);
        await expect(page).not.toHaveURL(new RegExp(`${route}$`));
        await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.TABLE)).toHaveCount(0);
        await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.EDITOR)).toHaveCount(0);
        await expect(page.getByTestId(NAVIGATION_HANDLES.EMAIL_TEMPLATES_LINK)).toHaveCount(0);
      }
    });
  });
}
