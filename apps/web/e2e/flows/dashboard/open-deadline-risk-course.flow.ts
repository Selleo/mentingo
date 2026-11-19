import { DASHBOARD_DEADLINE_RISK_HANDLES } from "../../data/dashboard/handles";

import type { Page } from "@playwright/test";

export const openDeadlineRiskCourseFlow = async (page: Page, courseId: string) => {
  await page.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.course(courseId)).click();
};

export const expandDeadlineRiskGroupFlow = async (page: Page, groupId: string) => {
  await page
    .getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.DIALOG)
    .getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.group(groupId))
    .click();
};
