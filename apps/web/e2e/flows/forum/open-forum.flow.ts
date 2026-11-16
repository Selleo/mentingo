import { expect, type Page } from "@playwright/test";

import { FORUM_HANDLES } from "../../data/forum/handles";

export const openForumFlow = async (page: Page) => {
  await page.goto("/forum");
  await expect(page.getByTestId(FORUM_HANDLES.PAGE)).toBeVisible();
};
