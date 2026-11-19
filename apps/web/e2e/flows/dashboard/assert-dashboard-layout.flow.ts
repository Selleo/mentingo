import { DASHBOARD_WIDGET_HANDLE_BY_TYPE } from "../../data/dashboard/dashboard.data";
import { DASHBOARD_WIDGET_HANDLES } from "../../data/dashboard/handles";
import { expect } from "../../fixtures/test.fixture";

import type { Page } from "@playwright/test";
import type { DashboardWidgetType } from "@repo/shared";

/** Asserts the dashboard renders exactly these widgets, in this order. */
export const assertDashboardWidgetOrderFlow = async (page: Page, types: DashboardWidgetType[]) => {
  const slots = page.getByTestId(DASHBOARD_WIDGET_HANDLES.SLOT);
  await expect(slots).toHaveCount(types.length);

  for (const [index, type] of types.entries()) {
    await expect(slots.nth(index).getByTestId(DASHBOARD_WIDGET_HANDLE_BY_TYPE[type])).toBeVisible();
  }
};
