import { GLOBAL_SEARCH_HANDLES } from "../../data/navigation/handles";

import type { Page } from "@playwright/test";

export const openGlobalSearchFlow = async (page: Page) => {
  await page.getByTestId(GLOBAL_SEARCH_HANDLES.TRIGGER).first().click();
  await page.getByTestId(GLOBAL_SEARCH_HANDLES.DIALOG).waitFor();
};
