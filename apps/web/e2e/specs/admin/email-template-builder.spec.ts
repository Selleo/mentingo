import { USER_ROLE } from "~/config/userRoles";

import {
  EDIT_EMAIL_TEMPLATE_HANDLES,
  EMAIL_TEMPLATES_HANDLES,
} from "../../data/email-templates/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openEditEmailTemplatePageFlow } from "../../flows/email-templates/open-edit-email-template-page.flow";
import { openEmailTemplatesPageFlow } from "../../flows/email-templates/open-email-templates-page.flow";

test("admin can create, edit, and delete an email template", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const emailTemplateFactory = factories.createEmailTemplateFactory();
    const updatedName = `E2E email template ${Date.now()}`;
    const updatedSubject = `E2E subject ${Date.now()}`;
    let templateId = "";

    cleanup.add(async () => {
      if (!templateId) return;
      const existingTemplate = await emailTemplateFactory.safeGetById(templateId);
      if (existingTemplate) await emailTemplateFactory.delete(templateId);
    });

    await openEmailTemplatesPageFlow(page);
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.CREATE_BUTTON).click();
    await expect(page).toHaveURL(/\/admin\/email-templates\/[^/]+$/);

    templateId = page.url().split("/").at(-1) ?? "";
    if (!templateId) throw new Error("Created email template id was not present in the URL");

    await expect(page.getByTestId(EDIT_EMAIL_TEMPLATE_HANDLES.PAGE)).toBeVisible();

    await page.getByTestId(EDIT_EMAIL_TEMPLATE_HANDLES.NAME_BUTTON).click();
    await page.getByTestId(EDIT_EMAIL_TEMPLATE_HANDLES.NAME_INPUT).fill(updatedName);
    await page.getByTestId(EDIT_EMAIL_TEMPLATE_HANDLES.NAME_INPUT).press("Enter");

    await expect
      .poll(async () => emailTemplateFactory.getById(templateId))
      .toMatchObject({
        name: updatedName,
      });

    const subjectEditor = page
      .getByTestId(EDIT_EMAIL_TEMPLATE_HANDLES.SUBJECT_INPUT)
      .locator(".ProseMirror");
    await subjectEditor.fill(updatedSubject);
    await page.getByTestId(EDIT_EMAIL_TEMPLATE_HANDLES.SAVE_BUTTON).click();

    await expect
      .poll(async () => {
        const template = await emailTemplateFactory.getById(templateId);
        return template.subject.en;
      })
      .toBe(updatedSubject);

    await openEditEmailTemplatePageFlow(page, templateId);
    await expect(page.getByTestId(EDIT_EMAIL_TEMPLATE_HANDLES.NAME_BUTTON)).toHaveText(updatedName);

    await openEmailTemplatesPageFlow(page);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.row(templateId))).toBeVisible();
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.rowCheckbox(templateId)).click();
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.DELETE_SELECTED_BUTTON).click();
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.DELETE_CONFIRM_BUTTON).click();

    await expect.poll(async () => emailTemplateFactory.safeGetById(templateId)).toBeNull();
    templateId = "";
  });
});
