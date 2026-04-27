import { QA_FORM_PAGE_HANDLES, QA_PAGE_HANDLES } from "../../data/qa/handles";

import { openQAPageFlow } from "./open-qa-page.flow";

import type { Page } from "@playwright/test";

export const openEditQAPageFlow = async (page: Page, qaId: string) => {
  await openQAPageFlow(page);
  await page.getByTestId(QA_PAGE_HANDLES.itemEditButton(qaId)).click();
  await page.waitForURL(new RegExp(`/qa/${qaId}(\\?.*)?$`));
  await page.getByTestId(QA_FORM_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
