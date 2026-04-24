import type { Page } from "@playwright/test";

export const clickVisibleTestIdFlow = async (page: Page, testId: string) => {
  const matches = page.getByTestId(testId);
  const count = await matches.count();

  for (let index = 0; index < count; index++) {
    const match = matches.nth(index);

    if (await match.isVisible()) {
      await match.click();
      return;
    }
  }

  await matches.first().click();
};
