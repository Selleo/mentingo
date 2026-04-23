import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

type FilterCoursesFlowInput = {
  title?: string;
  categoryTitle?: string;
  state?: "all" | "draft" | "published" | "private";
  archivedStatus?: "all" | "active" | "archived";
};

export const filterCoursesFlow = async (
  page: Page,
  { title, categoryTitle, state, archivedStatus }: FilterCoursesFlowInput,
) => {
  if (title !== undefined) {
    await page.getByTestId(COURSES_PAGE_HANDLES.TITLE_FILTER).fill(title);
  }

  if (categoryTitle !== undefined) {
    await page.getByTestId(COURSES_PAGE_HANDLES.CATEGORY_FILTER).click();
    await page.getByTestId(COURSES_PAGE_HANDLES.categoryFilterOption(categoryTitle)).click();
  }

  if (state !== undefined) {
    await page.getByTestId(COURSES_PAGE_HANDLES.STATE_FILTER).click();
    await page.getByTestId(COURSES_PAGE_HANDLES.stateFilterOption(state)).click();
  }

  if (archivedStatus !== undefined) {
    await page.getByTestId(COURSES_PAGE_HANDLES.ARCHIVED_FILTER).click();
    await page.getByTestId(COURSES_PAGE_HANDLES.archivedFilterOption(archivedStatus)).click();
  }
};
