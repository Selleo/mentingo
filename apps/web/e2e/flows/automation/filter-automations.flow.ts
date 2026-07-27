import { AUTOMATION_PAGE_HANDLES } from "../../data/automation/handles";

import type { Page } from "@playwright/test";

interface FilterAutomationsInput {
  search?: string;
  status?: string;
}

export const filterAutomationsFlow = async (
  page: Page,
  { search, status }: FilterAutomationsInput,
) => {
  if (search !== undefined) {
    const searchInput = page.getByTestId(AUTOMATION_PAGE_HANDLES.SEARCH_INPUT);
    await searchInput.clear();
    await searchInput.fill(search);
  }

  if (status !== undefined) {
    await page.getByTestId(AUTOMATION_PAGE_HANDLES.STATUS_FILTER).click();
    await page.getByRole("option", { name: new RegExp(status, "i") }).click();
  }
};
