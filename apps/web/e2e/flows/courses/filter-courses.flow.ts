import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";

import type { CourseStatusFilterValue } from "../../data/courses/handles";
import type { Page } from "@playwright/test";

type FilterCoursesFlowInput = {
  title?: string;
  categoryTitle?: string;
  state?: CourseStatusFilterValue;
  archivedStatus?: "all" | "active" | "archived";
};

export const filterCoursesFlow = async (
  page: Page,
  { title, categoryTitle, state, archivedStatus }: FilterCoursesFlowInput,
) => {
  if (title !== undefined) {
    const filteredCoursesResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());

      return (
        response.request().method() === "GET" &&
        url.pathname === "/api/course/all" &&
        (url.searchParams.get("title") ?? "") === title
      );
    });

    await page.getByTestId(COURSES_PAGE_HANDLES.TITLE_FILTER).fill(title);
    const response = await filteredCoursesResponse;
    await response.finished();
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
