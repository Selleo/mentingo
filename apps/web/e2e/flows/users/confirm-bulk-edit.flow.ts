import { USER_BULK_EDIT_MODAL_HANDLES } from "../../data/users/handles";

import type { Page } from "@playwright/test";

type ConfirmBulkEditFlowInput = {
  requireConfirmation?: boolean;
};

export const confirmBulkEditFlow = async (
  page: Page,
  { requireConfirmation = false }: ConfirmBulkEditFlowInput = {},
) => {
  await page.getByTestId(USER_BULK_EDIT_MODAL_HANDLES.DIALOG).waitFor({ state: "visible" });
  await page.getByTestId(USER_BULK_EDIT_MODAL_HANDLES.SUBMIT_BUTTON).click();

  if (requireConfirmation) {
    await page
      .getByTestId(USER_BULK_EDIT_MODAL_HANDLES.CONFIRMATION_DIALOG)
      .waitFor({ state: "visible" });
    await page.getByTestId(USER_BULK_EDIT_MODAL_HANDLES.CONFIRMATION_CONTINUE_BUTTON).click();
  }
};
