import { GROUPS_PAGE_HANDLES } from "../../data/groups/handles";

import type { Page } from "@playwright/test";

export const shiftSelectGroupRangeFlow = async (
  page: Page,
  firstGroupId: string,
  lastGroupId: string,
) => {
  const firstRowCheckbox = page.getByTestId(GROUPS_PAGE_HANDLES.rowCheckbox(firstGroupId));
  const lastRowCheckbox = page.getByTestId(GROUPS_PAGE_HANDLES.rowCheckbox(lastGroupId));

  await firstRowCheckbox.click();
  await lastRowCheckbox.click({ modifiers: ["Shift"] });
};
