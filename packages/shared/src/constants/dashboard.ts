import { FEATURES, type FeatureKey } from "./features";
import {
  PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  type PermissionKey,
  type SystemRoleSlug,
} from "./permissions";

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
  requiredPermissions?: readonly PermissionKey[];
  requiredFeature?: FeatureKey;
  requiresAiConfigured?: boolean;
};

export type DashboardDefinition = Record<DashboardWidgetId, DashboardWidgetDefinition>;

export const DASHBOARD_WIDGET_WIDTHS = {
  SMALL: 1,
  MEDIUM: 2,
} as const;

export const STUDENT_DASHBOARD_LIMITS = {
  CONTINUE_COURSES: 5,
  REQUIRED_COURSES: 5,
} as const;

export const STUDENT_COURSE_URGENCY = {
  OVERDUE: "overdue",
  DUE_SOON: "dueSoon",
  SCHEDULED: "scheduled",
  NO_DEADLINE: "noDeadline",
} as const;

export type StudentCourseUrgency =
  (typeof STUDENT_COURSE_URGENCY)[keyof typeof STUDENT_COURSE_URGENCY];

export const DASHBOARD_WIDGET_IDS = {
  ADMIN_EVENT_CALENDAR: "a_event_calendar",
  ADMIN_TRAINING_COMPLETION: "a_training_completion",
  ADMIN_INCOMPLETE_COURSES: "a_incomplete_courses",
  ADMIN_DEADLINE_RISKS: "a_deadline_risks",
  STUDENT_CONTINUE_LEARNING: "s_continue_learning",
  STUDENT_EVENT_CALENDAR: "s_event_calendar",
  STUDENT_REQUIRED_COURSE: "s_required_course",
  STUDENT_COURSE_COMPLETION: "s_course_completion",
  STUDENT_CERTIFICATES: "s_certificates",
  STUDENT_AI_MENTOR_PRACTICE: "s_ai_mentor_practice",
} as const;

export const DASHBOARD_DEADLINE_RISK_TYPES = {
  OVERDUE: "overdue",
  DUE_SOON: "dueSoon",
} as const;

export type DashboardDeadlineRiskType =
  (typeof DASHBOARD_DEADLINE_RISK_TYPES)[keyof typeof DASHBOARD_DEADLINE_RISK_TYPES];

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

  [DASHBOARD_WIDGET_IDS.STUDENT_CONTINUE_LEARNING]: {
    alwaysVisible: true,
    defaultVisible: true,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.MEDIUM,
    defaultOrder: 1,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.MEDIUM],
    allowedRoles: [SYSTEM_ROLE_SLUGS.STUDENT],
    requiredPermissions: [PERMISSIONS.COURSE_READ_ASSIGNED],
  },

  [DASHBOARD_WIDGET_IDS.STUDENT_REQUIRED_COURSE]: {
    alwaysVisible: false,
    defaultVisible: true,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.SMALL,
    defaultOrder: 3,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.SMALL, DASHBOARD_WIDGET_WIDTHS.MEDIUM],
    allowedRoles: [SYSTEM_ROLE_SLUGS.STUDENT],
    requiredPermissions: [PERMISSIONS.COURSE_READ_ASSIGNED],
  },

  [DASHBOARD_WIDGET_IDS.STUDENT_EVENT_CALENDAR]: {
    alwaysVisible: true,
    defaultVisible: true,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.MEDIUM,
    defaultOrder: 2,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.MEDIUM],
    allowedRoles: [SYSTEM_ROLE_SLUGS.STUDENT],
    requiredPermissions: [PERMISSIONS.CALENDAR_READ],
    requiredFeature: FEATURES.CALENDAR,
  },

  [DASHBOARD_WIDGET_IDS.STUDENT_COURSE_COMPLETION]: {
    alwaysVisible: false,
    defaultVisible: true,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.SMALL,
    defaultOrder: 4,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.SMALL],
    allowedRoles: [SYSTEM_ROLE_SLUGS.STUDENT],
    requiredPermissions: [PERMISSIONS.COURSE_READ_ASSIGNED],
  },

  [DASHBOARD_WIDGET_IDS.STUDENT_CERTIFICATES]: {
    alwaysVisible: false,
    defaultVisible: false,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.SMALL,
    defaultOrder: 5,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.SMALL, DASHBOARD_WIDGET_WIDTHS.MEDIUM],
    allowedRoles: [SYSTEM_ROLE_SLUGS.STUDENT],
    requiredPermissions: [PERMISSIONS.CERTIFICATE_READ],
  },

  [DASHBOARD_WIDGET_IDS.STUDENT_AI_MENTOR_PRACTICE]: {
    alwaysVisible: false,
    defaultVisible: false,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.MEDIUM,
    defaultOrder: 6,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.MEDIUM],
    allowedRoles: [SYSTEM_ROLE_SLUGS.STUDENT],
    requiredPermissions: [PERMISSIONS.AI_USE],
    requiresAiConfigured: true,
  },
} satisfies DashboardDefinition;
