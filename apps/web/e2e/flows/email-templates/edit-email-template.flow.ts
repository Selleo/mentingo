import { EMAIL_TEMPLATES_HANDLES } from "../../data/email-templates/handles";

import { editEmailTextFlow } from "./editor.flow";

import type { Page } from "@playwright/test";

export const editEmailTemplateFlow = async (
  page: Page,
  input: {
    name?: string;
    subject?: string;
    text?: { index: number; value: string };
  },
) => {
  if (input.name !== undefined)
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.NAME).fill(input.name);
  if (input.subject !== undefined)
    await page.getByTestId(EMAIL_TEMPLATES_HANDLES.SUBJECT).fill(input.subject);
  if (input.text) await editEmailTextFlow(page, input.text.index, input.text.value);
};

export const editEmailButtonFlow = async (page: Page, input: { label: string; url: string }) => {
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.BUTTON_LABEL).fill(input.label);
  await page.getByTestId(EMAIL_TEMPLATES_HANDLES.BUTTON_URL).fill(input.url);
};
