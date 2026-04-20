import { GROUP_FORM_HANDLES } from "../../data/groups/handles";

import type { Page } from "@playwright/test";

export const submitGroupFormFlow = async (page: Page) => {
  await page.getByTestId(GROUP_FORM_HANDLES.SUBMIT_BUTTON).click();
};
