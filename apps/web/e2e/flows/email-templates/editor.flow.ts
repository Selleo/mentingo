import { EMAIL_TEMPLATES_HANDLES } from "../../data/email-templates/handles";
import { EMAIL_TEMPLATE_DATA } from "../../data/test-data/email-template.data";

import type { Locator, Page } from "@playwright/test";
import type { SupportedLanguages } from "@repo/shared";

export const openEmailTemplateFlow = async (page: Page, id: string) => {
  await page.goto(`${EMAIL_TEMPLATE_DATA.listPath}/${id}`);
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT).waitFor();
};

export const editEmailTextFlow = async (page: Page, index: number, text: string) => {
  const block = page.getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK).nth(index);
  const editor = block.getByRole("textbox");
  if (!(await editor.isVisible()))
    await block.getByTestId(EMAIL_TEMPLATES_HANDLES.EDIT_BLOCK).click();
  await editor.fill(text);
};

export const selectEmailLanguageFlow = async (page: Page, language: SupportedLanguages) => {
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.LANGUAGE).click();
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.LANGUAGE_OPTION(language)).click();
};

export const confirmEmailActionFlow = async (page: Page, action: string) => {
  await page.getByTestId(action).click();
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.CONFIRM).click();
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.CONFIRM).waitFor({ state: "hidden" });
};

export const dragEmailBlockFlow = async (page: Page, source: Locator, target: Locator) => {
  await source.scrollIntoViewIfNeeded();
  const from = await source.boundingBox();
  if (!from) throw new Error("Email block drag handle has no bounding box");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 4 });
  await target.scrollIntoViewIfNeeded();
  const to = await target.boundingBox();
  if (!to) throw new Error("Email insertion point has no bounding box");
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();
};
