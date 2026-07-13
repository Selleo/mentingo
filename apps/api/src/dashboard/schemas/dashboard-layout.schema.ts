import { DASHBOARD_WIDGET_IDS, DASHBOARD_WIDGET_SIZES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { baseResponse } from "src/common";

import type { Static } from "@sinclair/typebox";

const dashboardWidgetIdSchema = Type.Union(
  Object.values(DASHBOARD_WIDGET_IDS).map((widgetId) => Type.Literal(widgetId)),
);

const dashboardWidgetSizeSchema = Type.Union(
  Object.values(DASHBOARD_WIDGET_SIZES).map((size) => Type.Literal(size)),
);

export const dashboardLayoutWidgetSchema = Type.Object({
  widgetId: dashboardWidgetIdSchema,
  order: Type.Integer({ minimum: 1 }),
  enabled: Type.Boolean(),
  size: dashboardWidgetSizeSchema,
  settings: Type.Record(Type.String(), Type.Unknown()),
});

export const dashboardLayoutSchema = Type.Array(dashboardLayoutWidgetSchema);

export const updateDashboardLayoutBodySchema = Type.Object({
  widgets: dashboardLayoutSchema,
});

export const dashboardLayoutResponseSchema = baseResponse(dashboardLayoutSchema);

export type DashboardLayoutWidgetSchema = Static<typeof dashboardLayoutWidgetSchema>;
export type UpdateDashboardLayoutBody = Static<typeof updateDashboardLayoutBodySchema>;
