import { expect, type Page } from "@playwright/test";

import { openContentMenuFlow } from "./open-content-menu.flow";
import { prepareNavigationPageFlow } from "./prepare-navigation-page.flow";

/** Opens the sidebar "Content" group from the dashboard and checks whether the link is listed. */
export const assertContentNavLinkFlow = async (
  page: Page,
  linkTestId: string,
  { visible }: { visible: boolean },
) => {
  await prepareNavigationPageFlow(page);
  await openContentMenuFlow(page);
  await expect(page.getByTestId(linkTestId)).toHaveCount(visible ? 1 : 0);
};
