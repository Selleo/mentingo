import { DASHBOARD_WIDGET_IDS } from "@repo/shared";
import {
  CalendarDays,
  CircleAlert,
  ClipboardCheck,
  GraduationCap,
  ListChecks,
  TrendingUp,
} from "lucide-react";

import { WidgetAdminPlaceholder1 } from "./widgets/admin-placeholder1";
import { WidgetAdminPlaceholder2 } from "./widgets/admin-placeholder2";
import { WidgetAdminPlaceholder3 } from "./widgets/admin-placeholder3";
import { WidgetStudentPlaceholder1 } from "./widgets/student-placeholder1";
import { WidgetStudentPlaceholder2 } from "./widgets/student-placeholder2";
import { WidgetStudentPlaceholder3 } from "./widgets/student-placeholder3";

import type { DashboardWidgetModule } from "./types";
import type { DashboardWidgetId } from "@repo/shared";

export type DashboardWidgetRegistry = Record<DashboardWidgetId, DashboardWidgetModule>;

export const DASHBOARD_WIDGET_REGISTRY: DashboardWidgetRegistry = {
  [DASHBOARD_WIDGET_IDS.ADMIN_PLACEHOLDER1]: {
    titleKey: "dashboardHome.widgets.a_placeholder_1.title",
    descriptionKey: "dashboardHome.widgets.placeholderDescription",
    icon: TrendingUp,
    component: WidgetAdminPlaceholder1,
  },
  [DASHBOARD_WIDGET_IDS.ADMIN_PLACEHOLDER2]: {
    titleKey: "dashboardHome.widgets.a_placeholder_2.title",
    descriptionKey: "dashboardHome.widgets.placeholderDescription",
    icon: CircleAlert,
    component: WidgetAdminPlaceholder2,
  },
  [DASHBOARD_WIDGET_IDS.ADMIN_PLACEHOLDER3]: {
    titleKey: "dashboardHome.widgets.a_placeholder_3.title",
    descriptionKey: "dashboardHome.widgets.placeholderDescription",
    icon: ListChecks,
    component: WidgetAdminPlaceholder3,
  },
  [DASHBOARD_WIDGET_IDS.STUDENT_PLACEHOLDER1]: {
    titleKey: "dashboardHome.widgets.s_placeholder_1.title",
    descriptionKey: "dashboardHome.widgets.placeholderDescription",
    icon: CalendarDays,
    component: WidgetStudentPlaceholder1,
  },
  [DASHBOARD_WIDGET_IDS.STUDENT_PLACEHOLDER2]: {
    titleKey: "dashboardHome.widgets.s_placeholder_2.title",
    descriptionKey: "dashboardHome.widgets.placeholderDescription",
    icon: GraduationCap,
    component: WidgetStudentPlaceholder2,
  },
  [DASHBOARD_WIDGET_IDS.STUDENT_PLACEHOLDER3]: {
    titleKey: "dashboardHome.widgets.s_placeholder_3.title",
    descriptionKey: "dashboardHome.widgets.placeholderDescription",
    icon: ClipboardCheck,
    component: WidgetStudentPlaceholder3,
  },
};
