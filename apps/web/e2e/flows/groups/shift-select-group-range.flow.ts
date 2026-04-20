import { GROUPS_PAGE_HANDLES } from "../../data/groups/handles";

import type { Page } from "@playwright/test";

export const shiftSelectGroupRangeFlow = async (
  page: Page,
  firstGroupId: string,
  lastGroupId: string,
) => {
  await page.getByTestId(GROUPS_PAGE_HANDLES.rowCheckbox(firstGroupId)).click();
  await page.getByTestId(GROUPS_PAGE_HANDLES.rowCheckbox(lastGroupId)).click({
    modifiers: ["Shift"],
  });
};
