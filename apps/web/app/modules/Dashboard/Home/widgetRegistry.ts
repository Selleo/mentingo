import { DASHBOARD_WIDGET_IDS } from "@repo/shared";
import {
  CalendarDays,
  CircleAlert,
  ClipboardCheck,
  GraduationCap,
  ListChecks,
  TrendingUp,
} from "lucide-react";

import { WidgetAdminDeadlineRisks } from "./widgets/admin-deadline-risks";
import { WidgetAdminEventCalendar } from "./widgets/admin-event-calendar";
import { WidgetAdminIncompleteCourses } from "./widgets/admin-incomplete-courses";
import { WidgetAdminTrainingCompletion } from "./widgets/admin-training-completion";
import { WidgetStudentPlaceholder1 } from "./widgets/student-placeholder1";
import { WidgetStudentPlaceholder2 } from "./widgets/student-placeholder2";
import { WidgetStudentPlaceholder3 } from "./widgets/student-placeholder3";

import type { DashboardWidgetModule } from "./types";
import type { DashboardWidgetId } from "@repo/shared";

export type DashboardWidgetRegistry = Record<DashboardWidgetId, DashboardWidgetModule>;

export const DASHBOARD_WIDGET_REGISTRY: DashboardWidgetRegistry = {
  [DASHBOARD_WIDGET_IDS.ADMIN_TRAINING_COMPLETION]: {
    titleKey: "dashboardHome.widgets.training_completion.title",
    descriptionKey: "dashboardHome.widgets.training_completion.description",
    icon: TrendingUp,
    iconClassName: "text-green-700",
    iconContainerClassName: "bg-green-50",
    component: WidgetAdminTrainingCompletion,
  },
  [DASHBOARD_WIDGET_IDS.ADMIN_DEADLINE_RISKS]: {
    titleKey: "dashboardHome.widgets.deadline_risks.title",
    descriptionKey: "dashboardHome.widgets.deadline_risks.description",
    icon: CircleAlert,
    iconClassName: "text-yellow-700",
    iconContainerClassName: "bg-yellow-50",
    component: WidgetAdminDeadlineRisks,
  },
  [DASHBOARD_WIDGET_IDS.ADMIN_INCOMPLETE_COURSES]: {
    titleKey: "dashboardHome.widgets.incomplete_courses.title",
    descriptionKey: "dashboardHome.widgets.incomplete_courses.description",
    icon: ListChecks,
    iconClassName: "text-purple-700",
    iconContainerClassName: "bg-purple-50",
    component: WidgetAdminIncompleteCourses,
  },
  [DASHBOARD_WIDGET_IDS.ADMIN_EVENT_CALENDAR]: {
    titleKey: "dashboardHome.widgets.event_calendar.title",
    descriptionKey: "dashboardHome.widgets.event_calendar.description",
    icon: CalendarDays,
    iconClassName: "text-blue-700",
    iconContainerClassName: "bg-blue-50",
    component: WidgetAdminEventCalendar,
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
