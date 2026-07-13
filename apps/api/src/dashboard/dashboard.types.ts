import type { DashboardWidgetId, DashboardWidgetSize, PermissionKey } from "@repo/shared";
import type { UUIDType } from "src/common";

export type DashboardWidgetDefinition = {
  id: DashboardWidgetId;
  defaultSize: DashboardWidgetSize;
  requiredPermissions: PermissionKey[];
};

export type DashboardLayoutWidget = {
  widgetId: DashboardWidgetId;
  order: number;
  enabled: boolean;
  size: DashboardWidgetSize;
  settings: Record<string, unknown>;
};

export type DashboardLayout = {
  id: UUIDType;
  version: number;
  widgets: DashboardLayoutWidget[];
};
