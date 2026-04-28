import { QA_FORM_PAGE_HANDLES, QA_PAGE_HANDLES } from "../../data/qa/handles";

import { openQAPageFlow } from "./open-qa-page.flow";

import type { Page } from "@playwright/test";

export const openCreateQAPageFlow = async (page: Page) => {
  await openQAPageFlow(page);
  await page.getByTestId(QA_PAGE_HANDLES.CREATE_BUTTON).click();
  await page.getByTestId(QA_FORM_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
