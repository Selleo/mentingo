import { USER_ROLE } from "~/config/userRoles";

import { EMAIL_TEMPLATES_HANDLES } from "../../data/email-templates/handles";
import {
  EMAIL_TEMPLATE_DATA,
  emailTemplateDocument,
} from "../../data/test-data/email-template.data";
import { appendEmailTextFlow } from "../../flows/email-templates/canvas.flow";
import { editEmailTemplateFlow } from "../../flows/email-templates/edit-email-template.flow";
import {
  openEmailTemplateFlow,
  selectEmailLanguageFlow,
} from "../../flows/email-templates/editor.flow";

import { expect, test } from "./email-template.fixture";

test("translations persist independently and a complete saved translation can become the base", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const template = await createEmailTemplate();
    await openEmailTemplateFlow(page, template.id!);
    await editEmailTemplateFlow(page, {
      subject: "English subject",
      text: { index: 0, value: "English body" },
    });
    await selectEmailLanguageFlow(page, EMAIL_TEMPLATE_DATA.polish);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.BASE_LANGUAGE)).toBeDisabled();
    await editEmailTemplateFlow(page, { name: "Polish name", subject: "Polish subject" });
    await appendEmailTextFlow(page, { index: 0, text: "Polish body" });
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.BASE_LANGUAGE)).toBeDisabled();
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE)).toBeDisabled();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.BASE_LANGUAGE)).toBeEnabled();
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.BASE_LANGUAGE).click();
    await expect
      .poll(async () => (await factory.getById(template.id!)).baseLanguage)
      .toBe(EMAIL_TEMPLATE_DATA.polish);
    await page.reload();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toHaveValue("Polish subject");
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK)).toHaveText(["Polish body"]);
    await selectEmailLanguageFlow(page, EMAIL_TEMPLATE_DATA.english);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toHaveValue("English subject");
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK)).toHaveText(["English body"]);
  });
});

test("saving English preserves another administrator's Polish changes", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const template = await createEmailTemplate({
      name: { en: "English name", pl: "Old Polish name" },
      subject: { en: "English subject", pl: "Old Polish subject" },
      content: {
        en: emailTemplateDocument("English body"),
        pl: emailTemplateDocument("Old Polish body"),
      },
    });
    await openEmailTemplateFlow(page, template.id!);
    await editEmailTemplateFlow(page, {
      name: "Updated English name",
      subject: "Updated English subject",
      text: { index: 0, value: "Updated English body" },
    });
    await factory.update(template.id!, {
      name: { pl: "Updated Polish name" },
      subject: { pl: "Updated Polish subject" },
      content: { pl: emailTemplateDocument("Updated Polish body") },
    });
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE)).toBeDisabled();
    await expect
      .poll(async () => (await factory.getById(template.id!)).content)
      .toMatchObject({
        en: emailTemplateDocument("Updated English body"),
        pl: emailTemplateDocument("Updated Polish body"),
      });
    await page.reload();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.NAME)).toHaveValue(
      "Updated English name",
    );
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toHaveValue(
      "Updated English subject",
    );
    await selectEmailLanguageFlow(page, EMAIL_TEMPLATE_DATA.polish);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.NAME)).toHaveValue("Updated Polish name");
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toHaveValue(
      "Updated Polish subject",
    );
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK)).toHaveText([
      "Updated Polish body",
    ]);
  });
});
