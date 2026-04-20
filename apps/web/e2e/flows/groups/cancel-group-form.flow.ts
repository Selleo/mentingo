import { GROUP_FORM_HANDLES } from "../../data/groups/handles";

import type { Page } from "@playwright/test";

export const cancelGroupFormFlow = async (page: Page) => {
  await page.getByTestId(GROUP_FORM_HANDLES.CANCEL_BUTTON).click();
};
