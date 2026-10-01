import { randomUUID } from "node:crypto";

import { USER_ROLE } from "~/config/userRoles";

import { EMAIL_TEMPLATES_HANDLES } from "../../data/email-templates/handles";
import {
  EMAIL_TEMPLATE_DATA,
  emailTemplateDocument,
} from "../../data/test-data/email-template.data";
import { editEmailTemplateFlow } from "../../flows/email-templates/edit-email-template.flow";
import { openEmailTemplateFlow, editEmailTextFlow } from "../../flows/email-templates/editor.flow";
import {
  copyEmailTemplateFlow,
  duplicateEmailTemplateFlow,
  returnToEmailCatalogFlow,
} from "../../flows/email-templates/template-actions.flow";

import { expect, test } from "./email-template.fixture";

test("copying a default creates an editable draft whose changes survive reopening", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  cleanup,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const original = await factory.getDefault();
    await openEmailTemplateFlow(page, `defaults/${EMAIL_TEMPLATE_DATA.event}`);
    const copy = await copyEmailTemplateFlow(page, { event: EMAIL_TEMPLATE_DATA.event });
    cleanup.add(() => factory.delete(copy.id!));
    await expect(page).toHaveURL(new RegExp(`/${copy.id}$`));
    const title = `${EMAIL_TEMPLATE_DATA.namePrefix} ${randomUUID()}`;
    await editEmailTemplateFlow(page, { name: title, subject: title });
    // The default starts with branding; edit its first textual block.
    const textIndex = original.content[original.baseLanguage]!.content.findIndex(
      (block) => block.type === "text",
    );
    await editEmailTextFlow(page, textIndex, "A personal invitation to learn");
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE)).toBeDisabled();
    await expect
      .poll(async () => (await factory.getById(copy.id!)).subject[original.baseLanguage])
      .toBe(title);
    await page.reload();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.NAME)).toHaveValue(title);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toHaveValue(title);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK).nth(textIndex)).toContainText(
      "A personal invitation to learn",
    );
    expect((await factory.getById(copy.id!)).status).toBe("draft");
    expect(await factory.getDefault()).toEqual(original);
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
    const original = await factory.publish(template.id!);
    await openEmailTemplateFlow(page, template.id!);
    const copy = await duplicateEmailTemplateFlow(page, { id: template.id! });
    cleanup.add(() => factory.delete(copy.id!));
    await expect(page).toHaveURL(new RegExp(`/${copy.id}$`));
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PUBLISH)).toBeVisible();
    await editEmailTextFlow(page, 0, "Only the copy changes");
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE)).toBeDisabled();
    await expect
      .poll(async () => (await factory.getById(copy.id!)).content.en)
      .toMatchObject(emailTemplateDocument("Only the copy changes"));
    expect((await factory.getById(copy.id!)).status).toBe("draft");
    expect(await factory.getById(template.id!)).toEqual(original);
  });
});

test("leaving an unsaved editor can be cancelled or confirmed without saving", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const template = await createEmailTemplate();
    await page.goto(EMAIL_TEMPLATE_DATA.listPath);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.TABLE)).toBeVisible();
    await openEmailTemplateFlow(page, template.id!);
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
    await expect(page).toHaveURL(new RegExp(`${EMAIL_TEMPLATE_DATA.listPath}$`));
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.TABLE)).toBeVisible();
    await openEmailTemplateFlow(page, template.id!);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toHaveValue(
      template.subject.en!,
    );
    expect((await factory.getById(template.id!)).subject).toEqual(template.subject);
  });
});
