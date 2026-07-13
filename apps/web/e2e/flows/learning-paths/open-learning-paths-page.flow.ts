import { LEARNING_PATHS_PAGE_HANDLES } from "../../data/learning-paths/handles";

import type { Page } from "@playwright/test";

export const openLearningPathsPageFlow = async (page: Page) => {
  await page.goto("/development-paths");
  await page.getByTestId(LEARNING_PATHS_PAGE_HANDLES.PAGE).waitFor();
};

export const openAdminLearningPathsPageFlow = async (page: Page) => {
  await page.goto("/development-paths");
  await page.getByTestId(LEARNING_PATHS_PAGE_HANDLES.ADMIN_PAGE).waitFor();
};
