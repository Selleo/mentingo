import { USER_ROLE } from "~/config/userRoles";

import { EMAIL_TEMPLATES_HANDLES } from "../../data/email-templates/handles";
import { EMAIL_TEMPLATE_DATA } from "../../data/test-data/email-template.data";
import { editEmailTemplateFlow } from "../../flows/email-templates/edit-email-template.flow";
import {
  openEmailTemplateFlow,
  confirmEmailActionFlow,
} from "../../flows/email-templates/editor.flow";
import {
  deleteEmailTemplateFlow,
  saveEmailDraftFlow,
} from "../../flows/email-templates/template-actions.flow";
import { requireId } from "../../utils/require-id";

import { expect, test } from "./email-template.fixture";

test("publishing saves current edits while other templates remain independently published", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const previous = await createEmailTemplate();
    const previousId = requireId(previous, "previous email template");
    await factory.publish(previousId);
    const template = await createEmailTemplate();
    const templateId = requireId(template, "email template");
    await openEmailTemplateFlow(page, templateId);
    await editEmailTemplateFlow(page, { subject: "Published directly from unsaved edits" });
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.PUBLISH).click();
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.CANCEL).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.CONFIRM)).toBeHidden();
    expect((await factory.getById(templateId)).status).toBe("draft");
    expect((await factory.getById(previousId)).status).toBe("published");
    await confirmEmailActionFlow(page, EMAIL_TEMPLATES_HANDLES.PUBLISH);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PUBLISH)).toBeDisabled();
    await expect
      .poll(async () => {
        const saved = await factory.getById(templateId);
        return {
          status: saved.status,
          subject: saved.subject.en,
          previous: (await factory.getById(previousId)).status,
        };
      })
      .toEqual({
        status: "published",
        subject: "Published directly from unsaved edits",
        previous: "published",
      });
    await page.reload();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toHaveValue(
      "Published directly from unsaved edits",
    );
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PUBLISH)).toBeDisabled();
    const { publicationVersion } = await factory.getById(templateId);
    if (typeof publicationVersion !== "number")
      throw new Error("Expected a published template version");
    await editEmailTemplateFlow(page, { subject: "Draft after publication" });
    await saveEmailDraftFlow(page);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE_MENU)).toBeDisabled();
    await expect
      .poll(async () => {
        const saved = await factory.getById(templateId);
        return {
          status: saved.status,
          publicationVersion: saved.publicationVersion,
          hasUnpublishedChanges: saved.hasUnpublishedChanges,
        };
      })
      .toEqual({
        status: "published",
        publicationVersion: publicationVersion,
        hasUnpublishedChanges: true,
      });
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PUBLISH)).toBeVisible();
    await confirmEmailActionFlow(page, EMAIL_TEMPLATES_HANDLES.PUBLISH);
    await expect
      .poll(async () => {
        const saved = await factory.getById(templateId);
        return {
          hasUnpublishedChanges: saved.hasUnpublishedChanges,
          publicationVersion: saved.publicationVersion,
        };
      })
      .toEqual({ hasUnpublishedChanges: false, publicationVersion: publicationVersion + 1 });
    expect((await factory.getById(previousId)).status).toBe("published");
  });
});

test("archived templates become read-only and can be restored to editable drafts", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const template = await createEmailTemplate();
    const templateId = requireId(template, "email template");
    await factory.publish(templateId);
    await openEmailTemplateFlow(page, templateId);
    await confirmEmailActionFlow(page, EMAIL_TEMPLATES_HANDLES.ARCHIVE);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toBeDisabled();
    await expect.poll(async () => (await factory.getById(templateId)).status).toBe("archived");
    await page.reload();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PALETTE_BLOCK("text"))).toBeDisabled();
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.RESTORE).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toBeEnabled();
    await editEmailTemplateFlow(page, { subject: "Restored content" });
    await saveEmailDraftFlow(page);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE_MENU)).toBeDisabled();
    await expect
      .poll(async () => {
        const saved = await factory.getById(templateId);
        return { status: saved.status, subject: saved.subject.en };
      })
      .toEqual({ status: "draft", subject: "Restored content" });
  });
});

test("deleting from the editor needs a saved draft and a confirmation", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const template = await createEmailTemplate();
    const templateId = requireId(template, "email template");
    await openEmailTemplateFlow(page, templateId);
    await editEmailTemplateFlow(page, { subject: "Unsaved change" });
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.ACTIONS).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.DELETE)).toBeDisabled();
    await page.keyboard.press("Escape");
    await saveEmailDraftFlow(page);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE_MENU)).toBeDisabled();

    await deleteEmailTemplateFlow(page, page.getByTestId(EMAIL_TEMPLATES_HANDLES.ACTIONS), {
      confirm: false,
    });
    await expect(page).toHaveURL(new RegExp(`/${templateId}$`));
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toHaveValue("Unsaved change");
    expect(await factory.exists(templateId)).toBe(true);
    await deleteEmailTemplateFlow(page, page.getByTestId(EMAIL_TEMPLATES_HANDLES.ACTIONS), {
      confirm: true,
    });

    await expect(page).toHaveURL(new URL(EMAIL_TEMPLATE_DATA.catalogPath, page.url()).toString());
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.TABLE)).toBeVisible();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.ROW(templateId))).toHaveCount(0);
    await expect.poll(() => factory.exists(templateId)).toBe(false);
  });
});

test("deleting from the list needs a confirmation", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const template = await createEmailTemplate();
    const templateId = requireId(template, "email template");
    await page.goto(EMAIL_TEMPLATE_DATA.listPath);
    const rowActions = page
      .getByTestId(EMAIL_TEMPLATES_HANDLES.ROW(templateId))
      .getByTestId(EMAIL_TEMPLATES_HANDLES.ACTIONS);

    await deleteEmailTemplateFlow(page, rowActions, { confirm: false });
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.ROW(templateId))).toBeVisible();
    expect(await factory.exists(templateId)).toBe(true);
    await deleteEmailTemplateFlow(page, rowActions, { confirm: true });

    await expect(page).toHaveURL(new URL(EMAIL_TEMPLATE_DATA.catalogPath, page.url()).toString());
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.TABLE)).toBeVisible();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.ROW(templateId))).toHaveCount(0);
    await expect.poll(() => factory.exists(templateId)).toBe(false);
  });
});
