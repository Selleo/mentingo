import { expect, type Page } from "@playwright/test";

export const clickHandleAndExpectUrlFlow = async (
  page: Page,
  handle: string,
  url: string | RegExp,
) => {
  await page.getByTestId(handle).click();
  await expect(page).toHaveURL(url);
};
