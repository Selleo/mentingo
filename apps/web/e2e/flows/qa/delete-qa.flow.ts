import { QA_DELETE_DIALOG_HANDLES, QA_PAGE_HANDLES } from "../../data/qa/handles";

import type { Page } from "@playwright/test";

export const deleteQAFlow = async (page: Page, qaId: string) => {
  await page.getByTestId(QA_PAGE_HANDLES.itemDeleteButton(qaId)).click();
  await page.getByTestId(QA_DELETE_DIALOG_HANDLES.CONFIRM_BUTTON).click();
};
