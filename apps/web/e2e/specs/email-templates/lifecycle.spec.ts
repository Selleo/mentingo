import { USER_ROLE } from "~/config/userRoles";

import { EMAIL_TEMPLATES_HANDLES } from "../../data/email-templates/handles";
import { EMAIL_TEMPLATE_DATA } from "../../data/test-data/email-template.data";
import { editEmailTemplateFlow } from "../../flows/email-templates/edit-email-template.flow";
import {
  openEmailTemplateFlow,
  confirmEmailActionFlow,
} from "../../flows/email-templates/editor.flow";

import { expect, test } from "./email-template.fixture";

test("publishing saves current edits and replaces the previous event override", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const previous = await createEmailTemplate();
    await factory.publish(previous.id!);
    const template = await createEmailTemplate();
    await openEmailTemplateFlow(page, template.id!);
    await editEmailTemplateFlow(page, { subject: "Published directly from unsaved edits" });
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.PUBLISH).click();
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.CANCEL).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.CONFIRM)).toBeHidden();
    expect((await factory.getById(template.id!)).status).toBe("draft");
    expect((await factory.getById(previous.id!)).status).toBe("published");
    await confirmEmailActionFlow(page, EMAIL_TEMPLATES_HANDLES.PUBLISH);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PUBLISH)).toHaveCount(0);
    await expect
      .poll(async () => {
        const saved = await factory.getById(template.id!);
        return {
          status: saved.status,
          subject: saved.subject.en,
          previous: (await factory.getById(previous.id!)).status,
        };
      })
      .toEqual({
        status: "published",
        subject: "Published directly from unsaved edits",
        previous: "archived",
      });
    await page.reload();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toHaveValue(
      "Published directly from unsaved edits",
    );
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PUBLISH)).toHaveCount(0);
  });
});

test("archived overrides become read-only and can be restored to editable drafts", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const template = await createEmailTemplate();
    await factory.publish(template.id!);
    await openEmailTemplateFlow(page, template.id!);
    await confirmEmailActionFlow(page, EMAIL_TEMPLATES_HANDLES.ARCHIVE);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toBeDisabled();
    await expect.poll(async () => (await factory.getById(template.id!)).status).toBe("archived");
    await page.reload();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PALETTE_BLOCK("text"))).toBeDisabled();
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.RESTORE).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toBeEnabled();
    await editEmailTemplateFlow(page, { subject: "Restored content" });
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE)).toBeDisabled();
    await expect
      .poll(async () => {
        const saved = await factory.getById(template.id!);
        return { status: saved.status, subject: saved.subject.en };
      })
      .toEqual({ status: "draft", subject: "Restored content" });
  });
});

for (const entry of ["editor", "list"] as const) {
  test(`deletion from the ${entry} requires confirmation and removes the saved template`, async ({
    withWorkerPage,
    emailTemplateFactory: factory,
    createEmailTemplate,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const template = await createEmailTemplate();
      await openEmailTemplateFlow(page, template.id!);
      if (entry === "editor") {
        await editEmailTemplateFlow(page, { subject: "Unsaved change" });
        await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.DELETE)).toBeDisabled();
        await page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE).click();
        await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE)).toBeDisabled();
      } else {
        await page.goto(EMAIL_TEMPLATE_DATA.listPath);
      }
      const deleteButton =
        entry === "editor"
          ? page.getByTestId(EMAIL_TEMPLATES_HANDLES.DELETE)
          : page
              .getByTestId(EMAIL_TEMPLATES_HANDLES.ROW(template.id!))
              .getByTestId(EMAIL_TEMPLATES_HANDLES.DELETE);
      await deleteButton.click();
      await page.getByTestId(EMAIL_TEMPLATES_HANDLES.CANCEL).click();
      await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.CONFIRM)).toBeHidden();
      expect(await factory.exists(template.id!)).toBe(true);
      await deleteButton.click();
      await page.getByTestId(EMAIL_TEMPLATES_HANDLES.CONFIRM).click();
      await expect(page).toHaveURL(new RegExp(`${EMAIL_TEMPLATE_DATA.listPath}$`));
      await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.TABLE)).toBeVisible();
      await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.ROW(template.id!))).toHaveCount(0);
      await expect.poll(() => factory.exists(template.id!)).toBe(false);
    });
  });
}
