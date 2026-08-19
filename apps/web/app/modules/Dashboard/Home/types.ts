import { DASHBOARD_WIDGET_SIZES } from "@repo/shared";

import type { DashboardWidgetSize, DashboardWidgetType } from "@repo/shared";
import type { LucideIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type DashboardWidgetIconComponent = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;

export const DASHBOARD_WIDGET_DATA_SCOPES = {
  PERSONAL: "personal",
  OTHER_USERS: "otherUsers",
} as const;

export type DashboardWidgetDataScope =
  (typeof DASHBOARD_WIDGET_DATA_SCOPES)[keyof typeof DASHBOARD_WIDGET_DATA_SCOPES];

export type DashboardLayoutItem = {
  id: DashboardWidgetType;
  size?: DashboardWidgetSize;
  allowedSizes?: DashboardWidgetSize[];
  visible?: boolean;
  order: number;
};

export type { DashboardWidgetSize } from "@repo/shared";

export const dashboardSizeToSpan = (size: DashboardWidgetSize | undefined) => {
  switch (size) {
    case DASHBOARD_WIDGET_SIZES.THREE_BY_TWO:
      return { columns: 3, rows: 2 };
    case DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO:
      return { columns: 4, rows: 2 };
    case DASHBOARD_WIDGET_SIZES.FOUR_BY_THREE:
      return { columns: 4, rows: 3 };
    case DASHBOARD_WIDGET_SIZES.FOUR_BY_ONE:
      return { columns: 4, rows: 1 };
    case DASHBOARD_WIDGET_SIZES.TWO_BY_TWO:
      return { columns: 2, rows: 2 };
    case DASHBOARD_WIDGET_SIZES.ONE_BY_TWO:
      return { columns: 1, rows: 2 };
    case DASHBOARD_WIDGET_SIZES.TWO_BY_ONE:
      return { columns: 2, rows: 1 };
    default:
      return { columns: 1, rows: 1 };
  }
};

export type DashboardWidgetMetadata = {
  titleKey: string;
  descriptionKey: string;
  dataScope: DashboardWidgetDataScope;
  icon: DashboardWidgetIconComponent;
  iconClassName?: string;
  iconContainerClassName?: string;
};

export type DashboardWidgetModule = DashboardWidgetMetadata & {
  component: ComponentType<{ widgetSize?: DashboardWidgetSize }>;
};
