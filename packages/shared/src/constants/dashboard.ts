import { FEATURES, type FeatureKey } from "./features";
import { SYSTEM_ROLE_SLUGS, type SystemRoleSlug } from "./permissions";

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[keyof typeof DASHBOARD_WIDGET_IDS];

export type DashboardWidgetWidth =
  (typeof DASHBOARD_WIDGET_WIDTHS)[keyof typeof DASHBOARD_WIDGET_WIDTHS];

export type DashboardWidgetDefinition = {
  alwaysVisible: boolean;
  defaultVisible: boolean;
  defaultWidth: DashboardWidgetWidth;
  defaultOrder: number;
  allowedWidths: readonly DashboardWidgetWidth[];
  allowedRoles?: readonly SystemRoleSlug[];
  requiredFeature?: FeatureKey;
};

export type DashboardDefinition = Record<DashboardWidgetId, DashboardWidgetDefinition>;

export const DASHBOARD_WIDGET_WIDTHS = {
  SMALL: 1,
  MEDIUM: 2,
} as const;

export const DASHBOARD_WIDGET_IDS = {
  ADMIN_EVENT_CALENDAR: "a_event_calendar",
  ADMIN_TRAINING_COMPLETION: "a_training_completion",
  ADMIN_INCOMPLETE_COURSES: "a_incomplete_courses",
  ADMIN_DEADLINE_RISKS: "a_deadline_risks",

  STUDENT_PLACEHOLDER1: "s_placeholder_1",
  STUDENT_PLACEHOLDER2: "s_placeholder_2",
  STUDENT_PLACEHOLDER3: "s_placeholder_3",
} as const;

export const DASHBOARD_WIDGETS = {
  [DASHBOARD_WIDGET_IDS.ADMIN_EVENT_CALENDAR]: {
    alwaysVisible: true,
    defaultVisible: true,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.MEDIUM,
    defaultOrder: 1,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.MEDIUM],
    allowedRoles: [SYSTEM_ROLE_SLUGS.ADMIN],
    requiredFeature: FEATURES.CALENDAR,
  },

  [DASHBOARD_WIDGET_IDS.ADMIN_TRAINING_COMPLETION]: {
    alwaysVisible: false,
    defaultVisible: true,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.SMALL,
    defaultOrder: 2,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.SMALL],
    allowedRoles: [SYSTEM_ROLE_SLUGS.ADMIN],
  },

  [DASHBOARD_WIDGET_IDS.ADMIN_INCOMPLETE_COURSES]: {
    alwaysVisible: false,
    defaultVisible: true,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.SMALL,
    defaultOrder: 3,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.SMALL],
    allowedRoles: [SYSTEM_ROLE_SLUGS.ADMIN],
  },

  [DASHBOARD_WIDGET_IDS.ADMIN_DEADLINE_RISKS]: {
    alwaysVisible: false,
    defaultVisible: false,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.SMALL,
    defaultOrder: 4,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.SMALL],
    allowedRoles: [SYSTEM_ROLE_SLUGS.ADMIN],
  },

  [DASHBOARD_WIDGET_IDS.STUDENT_PLACEHOLDER1]: {
    alwaysVisible: true,
    defaultVisible: true,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.MEDIUM,
    defaultOrder: 1,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.MEDIUM],
    allowedRoles: [SYSTEM_ROLE_SLUGS.STUDENT],
  },

  [DASHBOARD_WIDGET_IDS.STUDENT_PLACEHOLDER2]: {
    alwaysVisible: false,
    defaultVisible: true,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.SMALL,
    defaultOrder: 2,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.SMALL, DASHBOARD_WIDGET_WIDTHS.MEDIUM],
    allowedRoles: [SYSTEM_ROLE_SLUGS.STUDENT],
  },

  [DASHBOARD_WIDGET_IDS.STUDENT_PLACEHOLDER3]: {
    alwaysVisible: false,
    defaultVisible: true,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.SMALL,
    defaultOrder: 3,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.SMALL],
    allowedRoles: [SYSTEM_ROLE_SLUGS.STUDENT],
  },
} satisfies DashboardDefinition;
