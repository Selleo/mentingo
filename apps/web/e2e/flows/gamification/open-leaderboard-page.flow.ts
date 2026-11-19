import { expect, type Page } from "@playwright/test";

import { LEADERBOARD_HANDLES } from "../../data/gamification/handles";

export const openLeaderboardPageFlow = async (page: Page) => {
  await page.goto("/leaderboards");
  await expect(page.getByTestId(LEADERBOARD_HANDLES.PAGE)).toBeVisible();
};

/** Opens the scope select and returns its options. */
export const openLeaderboardScopeOptionsFlow = async (page: Page) => {
  await page.getByTestId(LEADERBOARD_HANDLES.SCOPE_SELECT).click();

  return page.getByRole("option");
};
