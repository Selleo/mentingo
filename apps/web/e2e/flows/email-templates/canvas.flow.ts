import { EMAIL_TEMPLATES_HANDLES } from "../../data/email-templates/handles";

import { dragEmailBlockFlow, editEmailTextFlow } from "./editor.flow";

import type { Page } from "@playwright/test";

export const appendEmailTextFlow = async (page: Page, input: { index: number; text: string }) => {
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.PALETTE_BLOCK("text")).click();
  await editEmailTextFlow(page, input.index, input.text);
};

export const insertEmailTextFlow = async (page: Page, input: { index: number; text: string }) => {
  await page
    .getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK)
    .nth(Math.max(0, input.index - 1))
    .hover();
  await page
    .getByTestId(EMAIL_TEMPLATES_HANDLES.INSERTION)
    .nth(input.index)
    .getByRole("button")
    .click();
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.INSERT_BLOCK("text")).click();
  await editEmailTextFlow(page, input.index, input.text);
};

export const reorderEmailBlockFlow = async (page: Page, input: { from: number; to: number }) => {
  await dragEmailBlockFlow(
    page,
    page
      .getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK)
      .nth(input.from)
      .getByTestId(EMAIL_TEMPLATES_HANDLES.DRAG_BLOCK),
    page.getByTestId(EMAIL_TEMPLATES_HANDLES.INSERTION).nth(input.to),
  );
};

export const insertEmailVariableFlow = async (
  page: Page,
  input: { index: number; key: string },
) => {
  await page
    .getByTestId(EMAIL_TEMPLATES_HANDLES.BLOCK)
    .nth(input.index)
    .getByRole("textbox")
    .press("End");
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.VARIABLE_SEARCH).fill(input.key);
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.VARIABLE(input.key)).click();
};

export const uploadEmailImageFlow = async (page: Page, input: { file: string; alt: string }) => {
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.PALETTE_BLOCK("image")).click();
  await page
    .getByTestId(EMAIL_TEMPLATES_HANDLES.IMAGE_UPLOAD)
    .locator('input[type="file"]')
    .setInputFiles(input.file);
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.IMAGE_ALT).fill(input.alt);
};
