import { expect, type Page } from "@playwright/test";

import { FORUM_HANDLES } from "../../data/forum/handles";

export const openForumFlow = async (page: Page, origin: string) => {
  await page.goto(new URL("/forum", origin).toString());
  await expect(page.getByTestId(FORUM_HANDLES.PAGE)).toBeVisible();
};
