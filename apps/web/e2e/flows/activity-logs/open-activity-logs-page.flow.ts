import { ACTIVITY_LOGS_HANDLES } from "../../data/activity-logs/handles";

import type { Page } from "@playwright/test";

export const openActivityLogsPageFlow = async (page: Page) => {
  await page.goto("/admin/activity-logs");
  await page.getByTestId(ACTIVITY_LOGS_HANDLES.PAGE).waitFor();
};
