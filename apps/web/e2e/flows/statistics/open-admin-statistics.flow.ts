import { ADMIN_STATISTICS_HANDLES } from "../../data/statistics/handles";

import type { Page } from "@playwright/test";

export const openAdminStatisticsFlow = async (page: Page) => {
  await page.goto("/admin/analytics");
  await page.getByTestId(ADMIN_STATISTICS_HANDLES.PAGE).waitFor();
};
