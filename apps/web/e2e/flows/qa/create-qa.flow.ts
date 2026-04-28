import { fillQAFormFlow } from "./fill-qa-form.flow";
import { openCreateQAPageFlow } from "./open-create-qa-page.flow";
import { submitQAFormFlow } from "./submit-qa-form.flow";

import type { Page } from "@playwright/test";
import type { SupportedLanguages } from "@repo/shared";

type CreateQAFlowInput = {
  language?: SupportedLanguages;
  title: string;
  description: string;
};

export const createQAFlow = async (page: Page, input: CreateQAFlowInput) => {
  await openCreateQAPageFlow(page);
  await fillQAFormFlow(page, input);
  await submitQAFormFlow(page);
};
