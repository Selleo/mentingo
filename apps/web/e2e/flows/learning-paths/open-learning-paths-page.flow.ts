import { LEARNING_PATHS_PAGE_HANDLES } from "../../data/learning-paths/handles";

import type { Page } from "@playwright/test";

export const openLearningPathsPageFlow = async (page: Page, searchQuery?: string) => {
  const searchParams = new URLSearchParams();
  if (searchQuery) searchParams.set("searchQuery", searchQuery);

  const query = searchParams.toString();
  await page.goto(query ? `/development-paths?${query}` : "/development-paths");
  await page.getByTestId(LEARNING_PATHS_PAGE_HANDLES.HEADING).waitFor();
};
