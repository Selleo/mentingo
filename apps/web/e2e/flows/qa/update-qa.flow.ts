import { fillQAFormFlow } from "./fill-qa-form.flow";
import { openEditQAPageFlow } from "./open-edit-qa-page.flow";
import { submitQAFormFlow } from "./submit-qa-form.flow";

import type { Page } from "@playwright/test";

type UpdateQAFlowInput = {
  qaId: string;
  title?: string;
  description?: string;
};

export const updateQAFlow = async (page: Page, input: UpdateQAFlowInput) => {
  await openEditQAPageFlow(page, input.qaId);
  await fillQAFormFlow(page, input);
  await submitQAFormFlow(page);
};
