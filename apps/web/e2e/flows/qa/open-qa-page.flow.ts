import { QA_PAGE_HANDLES } from "../../data/qa/handles";

import type { Page } from "@playwright/test";

export const openQAPageFlow = async (page: Page) => {
  await page.goto("/qa");
  await page.getByTestId(QA_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
