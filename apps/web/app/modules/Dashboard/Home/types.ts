import type { DashboardWidgetId, DashboardWidgetWidth } from "@repo/shared";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

export type DashboardLayoutItem = {
  id: DashboardWidgetId;
  width: DashboardWidgetWidth;
  order: number;
};

export type DashboardWidgetMetadata = {
  titleKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  iconClassName?: string;
  iconContainerClassName?: string;
};

export type DashboardWidgetModule = DashboardWidgetMetadata & {
  component: ComponentType;
};
