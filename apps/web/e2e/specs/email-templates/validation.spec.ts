import { USER_ROLE } from "~/config/userRoles";

import { EMAIL_TEMPLATES_HANDLES } from "../../data/email-templates/handles";
import { editEmailButtonFlow } from "../../flows/email-templates/edit-email-template.flow";
import { openEmailTemplateFlow } from "../../flows/email-templates/editor.flow";
import { saveEmailDraftFlow } from "../../flows/email-templates/template-actions.flow";

import { expect, test } from "./email-template.fixture";

test("incomplete button validation prevents saving until the administrator fixes it", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const template = await createEmailTemplate();
    await openEmailTemplateFlow(page, template.id!);
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.PALETTE_BLOCK("button")).click();
    await editEmailButtonFlow(page, { label: "", url: "" });
    await saveEmailDraftFlow(page);
    const invalidBlock = page.getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK).last();
    await expect(invalidBlock).toHaveAttribute("aria-describedby", /-error$/);
    const errorId = await invalidBlock.getAttribute("aria-describedby");
    await expect(page.locator(`[id="${errorId}"]`)).toBeVisible();
    expect((await factory.getById(template.id!)).content).toEqual(template.content);
    await editEmailButtonFlow(page, { label: "Start learning", url: "https://example.com/learn" });
    await expect(invalidBlock).not.toHaveAttribute("aria-describedby", /-error$/);
    await page.locator(`[id="${errorId}"]`).waitFor({ state: "detached" });
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.BUTTON_URL).blur();
    await saveEmailDraftFlow(page);
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.SAVE_MENU)).toBeDisabled();
    await expect
      .poll(async () => (await factory.getById(template.id!)).content.en?.content.at(-1))
      .toEqual({
        type: "button",
        attrs: { label: "Start learning", url: "https://example.com/learn" },
      });
    await page.reload();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK).last()).toContainText(
      "Start learning",
    );
  });
});

test("publishing an incomplete base-language subject fails without activating the draft", async ({
  withWorkerPage,
  emailTemplateFactory: factory,
  createEmailTemplate,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const template = await createEmailTemplate({ subject: { en: "" } });
    await openEmailTemplateFlow(page, template.id!);
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.PUBLISH).click();
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.CONFIRM).click();
    await expect(page.getByTestId(EMAIL_TEMPLATES_HANDLES.ERROR)).toBeVisible();
    await expect.poll(async () => (await factory.getById(template.id!)).status).toBe("draft");
  });
});
