import type { Locator } from "@playwright/test";

/** Scrolls an infinite widget list to its end so the widget loads the next page. */
export const scrollDashboardListToEndFlow = async (list: Locator) => {
  await list.evaluate((element) => {
    const scrollTopBefore = element.scrollTop;
    element.scrollTop = element.scrollHeight;
    // A list that fits without overflow never scrolls, so notify its scroll handler directly.
    if (element.scrollTop === scrollTopBefore) element.dispatchEvent(new Event("scroll"));
  });
};
