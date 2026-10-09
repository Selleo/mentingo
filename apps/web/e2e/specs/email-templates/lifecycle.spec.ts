import { USER_ROLE } from "~/config/userRoles";

import { EMAIL_TEMPLATES_HANDLES } from "../../data/email-templates/handles";
import { EMAIL_TEMPLATE_DATA } from "../../data/test-data/email-template.data";
import { editEmailTemplateFlow } from "../../flows/email-templates/edit-email-template.flow";
import {
  openEmailTemplateFlow,
  confirmEmailActionFlow,
} from "../../flows/email-templates/editor.flow";
import { saveEmailDraftFlow } from "../../flows/email-templates/template-actions.flow";

import { expect, test } from "./email-template.fixture";

test("publishing saves current edits while other templates remain independently published", async ({
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
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PUBLISH)).toBeDisabled();
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
        previous: "published",
      });
    await page.reload();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT)).toHaveValue(
      "Published directly from unsaved edits",
    );
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PUBLISH)).toBeDisabled();
    const publicationVersion = (await factory.getById(template.id!)).publicationVersion;
    await editEmailTemplateFlow(page, { subject: "Draft after publication" });
    await saveEmailDraftFlow(page);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE_MENU)).toBeDisabled();
    await expect
      .poll(async () => {
        const saved = await factory.getById(template.id!);
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
        const saved = await factory.getById(template.id!);
        return {
          hasUnpublishedChanges: saved.hasUnpublishedChanges,
          publicationVersion: saved.publicationVersion,
        };
      })
      .toEqual({ hasUnpublishedChanges: false, publicationVersion: publicationVersion! + 1 });
    expect((await factory.getById(previous.id!)).status).toBe("published");
  });
});

test("archived templates become read-only and can be restored to editable drafts", async ({
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
    await saveEmailDraftFlow(page);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE_MENU)).toBeDisabled();
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
        await page.getByTestId(EMAIL_TEMPLATES_HANDLES.ACTIONS).click();
        await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.DELETE)).toBeDisabled();
        await page.keyboard.press("Escape");
        await saveEmailDraftFlow(page);
        await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE_MENU)).toBeDisabled();
      } else {
        await page.goto(EMAIL_TEMPLATE_DATA.listPath);
      }
      const actionsMenu =
        entry === "editor"
          ? page.getByTestId(EMAIL_TEMPLATES_HANDLES.ACTIONS)
          : page
              .getByTestId(EMAIL_TEMPLATES_HANDLES.ROW(template.id!))
              .getByTestId(EMAIL_TEMPLATES_HANDLES.ACTIONS);
      const deleteButton = page.getByTestId(EMAIL_TEMPLATES_HANDLES.DELETE);
      await actionsMenu.click();
      await deleteButton.click();
      await page.getByTestId(EMAIL_TEMPLATES_HANDLES.CANCEL).click();
      await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.CONFIRM)).toBeHidden();
      expect(await factory.exists(template.id!)).toBe(true);
      await actionsMenu.click();
      await deleteButton.click();
      await page.getByTestId(EMAIL_TEMPLATES_HANDLES.CONFIRM).click();
      await expect(page).toHaveURL(new URL(EMAIL_TEMPLATE_DATA.catalogPath, page.url()).toString());
      await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.TABLE)).toBeVisible();
      await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.ROW(template.id!))).toHaveCount(0);
      await expect.poll(() => factory.exists(template.id!)).toBe(false);
    });
  });
}
