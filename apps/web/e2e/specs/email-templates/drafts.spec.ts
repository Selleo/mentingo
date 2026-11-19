import { randomUUID } from "node:crypto";

import { USER_ROLE } from "~/config/userRoles";
import { AUTOMATION_WORKSPACE_TABS } from "~/modules/Admin/Automations/Workspace/workspace.constants";

import { EMAIL_TEMPLATES_HANDLES } from "../../data/email-templates/handles";
import {
  EMAIL_TEMPLATE_DATA,
  emailTemplateDocument,
} from "../../data/test-data/email-template.data";
import { editEmailTemplateFlow } from "../../flows/email-templates/edit-email-template.flow";
import { openEmailTemplateFlow, editEmailTextFlow } from "../../flows/email-templates/editor.flow";
import {
  saveEmailDraftFlow,
  copyEmailTemplateFlow,
  duplicateEmailTemplateFlow,
  returnToEmailCatalogFlow,
} from "../../flows/email-templates/template-actions.flow";
import { requireId } from "../../utils/require-id";

import { expect, test } from "./email-template.fixture";

test("copying a default creates an editable draft whose changes survive reopening", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  cleanup,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const original = await factory.getDefault();
    await openEmailTemplateFlow(page, `defaults/${EMAIL_TEMPLATE_DATA.builtInTemplateKey}`);
    const copy = await copyEmailTemplateFlow(page, {
      templateKey: EMAIL_TEMPLATE_DATA.builtInTemplateKey,
    });
    const copyId = requireId(copy, "copied email template");
    cleanup.add(() => factory.delete(copyId));
    await expect(page).toHaveURL(new RegExp(`/${copyId}$`));
    const title = `${EMAIL_TEMPLATE_DATA.namePrefix} ${randomUUID()}`;
    await editEmailTemplateFlow(page, { name: title, subject: title });
    // The default starts with branding; edit its first textual block.
    const textIndex = original.content[original.baseLanguage]!.content.findIndex(
      (block) => block.type === "text",
    );
    await editEmailTextFlow(page, textIndex, "A personal invitation to learn");
    await saveEmailDraftFlow(page);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE_MENU)).toBeDisabled();
    await expect
      .poll(async () => (await factory.getById(copyId)).subject[original.baseLanguage])
      .toBe(title);
    await page.reload();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.NAME)).toHaveValue(title);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toHaveValue(title);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK).nth(textIndex)).toContainText(
      "A personal invitation to learn",
    );
    await expect.poll(async () => (await factory.getById(copyId)).status).toBe("draft");
    await expect.poll(() => factory.getDefault()).toEqual(original);
  });
});

test("duplicating a published template creates an independent draft", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
  cleanup,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const template = await createEmailTemplate();
    const templateId = requireId(template, "email template");
    const original = await factory.publish(templateId);
    await openEmailTemplateFlow(page, templateId);
    const copy = await duplicateEmailTemplateFlow(page, { id: templateId });
    const copyId = requireId(copy, "copied email template");
    cleanup.add(() => factory.delete(copyId));
    await expect(page).toHaveURL(new RegExp(`/${copyId}$`));
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PUBLISH)).toBeVisible();
    await editEmailTextFlow(page, 0, "Only the copy changes");
    await saveEmailDraftFlow(page);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE_MENU)).toBeDisabled();
    await expect
      .poll(async () => (await factory.getById(copyId)).content.en)
      .toMatchObject(emailTemplateDocument("Only the copy changes"));
    await expect.poll(async () => (await factory.getById(copyId)).status).toBe("draft");
    await expect.poll(() => factory.getById(templateId)).toEqual(original);
  });
});

test("leaving an unsaved editor can be cancelled or confirmed without saving", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const template = await createEmailTemplate();
    const templateId = requireId(template, "email template");
    const savedSubject = template.subject.en;
    if (!savedSubject) throw new Error("Expected the email template to have an English subject");
    await page.goto(EMAIL_TEMPLATE_DATA.listPath);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.TABLE)).toBeVisible();
    await openEmailTemplateFlow(page, templateId);
    await editEmailTemplateFlow(page, { subject: "Changes to discard" });
    await returnToEmailCatalogFlow(page);
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.STAY).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.LEAVE)).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/${template.id}$`));
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toHaveValue(
      "Changes to discard",
    );
    await returnToEmailCatalogFlow(page);
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.LEAVE).click();
    await page
      .getByTestId(EMAIL_TEMPLATES_HANDLES.WORKSPACE_TAB(AUTOMATION_WORKSPACE_TABS.EMAIL_TEMPLATES))
      .click();
    await expect(page).toHaveURL(new URL(EMAIL_TEMPLATE_DATA.catalogPath, page.url()).toString());
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.TABLE)).toBeVisible();
    await openEmailTemplateFlow(page, templateId);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toHaveValue(savedSubject);
    expect((await factory.getById(templateId)).subject).toEqual(template.subject);
  });
});
