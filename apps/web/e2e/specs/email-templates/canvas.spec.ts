import path from "node:path";

import { USER_ROLE } from "~/config/userRoles";

import { EMAIL_TEMPLATES_HANDLES } from "../../data/email-templates/handles";
import {
  EMAIL_TEMPLATE_DATA,
  emailTemplateDocument,
} from "../../data/test-data/email-template.data";
import {
  appendEmailTextFlow,
  clickEmailBlockActionFlow,
  insertEmailTextFlow,
  reorderEmailBlockFlow,
  insertEmailVariableFlow,
  uploadEmailImageFlow,
} from "../../flows/email-templates/canvas.flow";
import { openEmailTemplateFlow, editEmailTextFlow } from "../../flows/email-templates/editor.flow";
import { saveEmailDraftFlow } from "../../flows/email-templates/template-actions.flow";

import { expect, test } from "./email-template.fixture";

test("canvas composition persists insertion, duplication, removal and pointer reordering", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const template = await createEmailTemplate({
      content: { en: emailTemplateDocument("First", "Last") },
    });
    await openEmailTemplateFlow(page, template.id!);
    await appendEmailTextFlow(page, { index: 2, text: "Added" });
    await clickEmailBlockActionFlow(page, {
      index: 2,
      action: EMAIL_TEMPLATES_HANDLES.DUPLICATE_BLOCK,
    });
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK)).toHaveCount(4);
    await clickEmailBlockActionFlow(page, {
      index: 3,
      action: EMAIL_TEMPLATES_HANDLES.REMOVE_BLOCK,
    });
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK)).toHaveCount(3);
    await insertEmailTextFlow(page, { index: 1, text: "Between" });
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK)).toHaveText([
      "First",
      "Between",
      "Last",
      "Added",
    ]);
    await reorderEmailBlockFlow(page, { from: 3, to: 0 });
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK)).toHaveText([
      "Added",
      "First",
      "Between",
      "Last",
    ]);
    await saveEmailDraftFlow(page);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE_MENU)).toBeDisabled();
    await expect
      .poll(async () => (await factory.getById(template.id!)).content.en)
      .toMatchObject(emailTemplateDocument("Added", "First", "Between", "Last"));
    await page.reload();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK)).toHaveText([
      "Added",
      "First",
      "Between",
      "Last",
    ]);
  });
});

test("variable insertion and mobile preview preserve unsaved content without saving", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const template = await createEmailTemplate();
    await openEmailTemplateFlow(page, template.id!);
    await editEmailTextFlow(page, 0, "Learn: ");
    await insertEmailVariableFlow(page, { index: 0, key: EMAIL_TEMPLATE_DATA.variable });
    const expected = `Learn: {{ ${EMAIL_TEMPLATE_DATA.variable} }}`;
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK).first()).toContainText(expected);
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.PREVIEW).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PALETTE)).toBeHidden();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SETTINGS)).toBeHidden();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.DRAG_BLOCK)).toHaveCount(0);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.CANVAS).getByRole("textbox")).toHaveCount(
      0,
    );
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.MOBILE).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.CANVAS)).toHaveCSS("width", "375px");
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.CANVAS)).toContainText(expected);
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.DESKTOP).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.DESKTOP)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.PREVIEW).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SETTINGS)).toBeVisible();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.PALETTE)).toBeVisible();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE_MENU)).toBeEnabled();
    expect((await factory.getById(template.id!)).content).toEqual(template.content);
    await saveEmailDraftFlow(page);
    await expect
      .poll(async () => (await factory.getById(template.id!)).content.en)
      .toMatchObject(emailTemplateDocument(expected));
  });
});

test("an uploaded image remains visible after saving and reopening", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const template = await createEmailTemplate();
    await openEmailTemplateFlow(page, template.id!);
    await uploadEmailImageFlow(page, {
      file: path.resolve("e2e/data/curriculum/files/content-image.png"),
      alt: "Learning illustration",
    });
    const image = page
      .getByTestId(EMAIL_TEMPLATES_HANDLES.CANVAS)
      .getByRole("img", { name: "Learning illustration" });
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
      .toBeGreaterThan(0);
    await saveEmailDraftFlow(page);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE_MENU)).toBeDisabled();
    await expect
      .poll(async () => (await factory.getById(template.id!)).content.en?.content.at(-1))
      .toMatchObject({
        type: "image",
        attrs: { alt: "Learning illustration", src: expect.stringMatching(/^asset:/) },
      });
    await page.reload();
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
      .toBeGreaterThan(0);
  });
});
