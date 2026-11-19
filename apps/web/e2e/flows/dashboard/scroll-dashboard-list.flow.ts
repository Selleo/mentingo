import { expect } from "@playwright/test";

import type { Locator } from "@playwright/test";

/** Scrolls an infinite widget list to its end so the widget loads the next page. */
export const scrollDashboardListToEndFlow = async (list: Locator) => {
  const scrolled = await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop > 0;
  });

  expect(scrolled, "the list must overflow to load the next page").toBe(true);
};
