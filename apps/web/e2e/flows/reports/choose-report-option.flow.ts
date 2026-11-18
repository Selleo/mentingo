import type { Locator, Page } from "@playwright/test";

/**
 * Opens a report picker or select and chooses the option with the given handle.
 * `search` is typed into the picker's focused search box first, for options loaded by search.
 */
export const chooseReportOptionFlow = async (
  page: Page,
  trigger: Locator,
  optionHandle: string,
  search?: string,
) => {
  await trigger.click();
  if (search) await page.keyboard.type(search);
  await page.getByTestId(optionHandle).click();
};
