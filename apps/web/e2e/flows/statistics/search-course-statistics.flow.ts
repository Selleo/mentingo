import { COURSE_STATISTICS_HANDLES } from "../../data/statistics/handles";

import type { Page } from "@playwright/test";

export const searchCourseStatisticsFlow = async (page: Page, search: string) => {
  await page.getByTestId(COURSE_STATISTICS_HANDLES.DETAILS_SEARCH_INPUT).fill(search);
};
