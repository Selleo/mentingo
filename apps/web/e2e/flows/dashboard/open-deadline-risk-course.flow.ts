import { DASHBOARD_WIDGET_HANDLES } from "../../data/dashboard/handles";

import type { Page } from "@playwright/test";

export const openDeadlineRiskCourseFlow = async (page: Page, courseTitle: string) => {
  const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_DEADLINE_RISKS);
  await widget.getByRole("button", { name: new RegExp(courseTitle) }).click();
};

export const expandDeadlineRiskGroupFlow = async (page: Page, groupName: string) => {
  const dialog = page.getByRole("dialog");
  await dialog.getByText(groupName).click();
};
