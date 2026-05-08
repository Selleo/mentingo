import { expect, type Page } from "@playwright/test";

import { COURSE_STATISTICS_HANDLES } from "../../data/statistics/handles";

export const openCourseStatisticsFlow = async (page: Page, courseId: string) => {
  await page.goto(`/course/${courseId}`);

  const statisticsTab = page.getByTestId(COURSE_STATISTICS_HANDLES.COURSE_VIEW_STATISTICS_TAB);

  await statisticsTab.waitFor({ state: "visible" });
  await statisticsTab.click();
  await expect(statisticsTab).toHaveAttribute("data-state", "active");
  await page.getByTestId(COURSE_STATISTICS_HANDLES.ROOT).waitFor({ state: "visible" });
};
