import type { DashboardWidgetId, DashboardWidgetType } from "@repo/shared";
import type { LucideIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type DashboardWidgetIconComponent = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;

export type DashboardLayoutItem = {
  id: DashboardWidgetId;
  type?: DashboardWidgetType | string;
  size?: DashboardWidgetSize;
  allowedSizes?: DashboardWidgetSize[];
  visible?: boolean;
  order: number;
};

export const DASHBOARD_WIDGET_SIZES = {
  ONE_BY_ONE: "1x1",
  TWO_BY_ONE: "2x1",
  ONE_BY_TWO: "1x2",
  TWO_BY_TWO: "2x2",
  THREE_BY_TWO: "3x2",
  FOUR_BY_ONE: "4x1",
  FOUR_BY_TWO: "4x2",
  FOUR_BY_THREE: "4x3",
} as const;

export type DashboardWidgetSize =
  (typeof DASHBOARD_WIDGET_SIZES)[keyof typeof DASHBOARD_WIDGET_SIZES];

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
  icon: DashboardWidgetIconComponent;
  iconClassName?: string;
  iconContainerClassName?: string;
};

export type DashboardWidgetModule = DashboardWidgetMetadata & {
  component: ComponentType<{ widgetSize?: DashboardWidgetSize }>;
};
