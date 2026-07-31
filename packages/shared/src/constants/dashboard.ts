import {
  PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  type PermissionKey,
  type SystemRoleSlug,
} from "./permissions";

import type { FeatureKey } from "./features";

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

export const DASHBOARD_WIDGET_IDS = {
  ADMIN_PLACEHOLDER1: "a_placeholder_1",
  ADMIN_PLACEHOLDER2: "a_placeholder_2",
  ADMIN_PLACEHOLDER3: "a_placeholder_3",
  STUDENT_CONTINUE_LEARNING: "s_continue_learning",
  STUDENT_REQUIRED_COURSE: "s_required_course",
  STUDENT_COURSE_COMPLETION: "s_course_completion",
  STUDENT_CERTIFICATES: "s_certificates",
  STUDENT_AI_MENTOR_PRACTICE: "s_ai_mentor_practice",
} as const;

export const DASHBOARD_WIDGETS = {
  [DASHBOARD_WIDGET_IDS.ADMIN_PLACEHOLDER1]: {
    alwaysVisible: true,
    defaultVisible: true,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.MEDIUM,
    defaultOrder: 1,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.MEDIUM],
    allowedRoles: [SYSTEM_ROLE_SLUGS.ADMIN],
  },

  [DASHBOARD_WIDGET_IDS.ADMIN_PLACEHOLDER2]: {
    alwaysVisible: false,
    defaultVisible: true,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.SMALL,
    defaultOrder: 2,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.SMALL, DASHBOARD_WIDGET_WIDTHS.MEDIUM],
    allowedRoles: [SYSTEM_ROLE_SLUGS.ADMIN],
  },

  [DASHBOARD_WIDGET_IDS.ADMIN_PLACEHOLDER3]: {
    alwaysVisible: false,
    defaultVisible: true,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.SMALL,
    defaultOrder: 3,
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
    defaultOrder: 2,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.SMALL, DASHBOARD_WIDGET_WIDTHS.MEDIUM],
    allowedRoles: [SYSTEM_ROLE_SLUGS.STUDENT],
    requiredPermissions: [PERMISSIONS.COURSE_READ_ASSIGNED],
  },

  [DASHBOARD_WIDGET_IDS.STUDENT_COURSE_COMPLETION]: {
    alwaysVisible: false,
    defaultVisible: true,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.SMALL,
    defaultOrder: 3,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.SMALL],
    allowedRoles: [SYSTEM_ROLE_SLUGS.STUDENT],
    requiredPermissions: [PERMISSIONS.COURSE_READ_ASSIGNED],
  },

  [DASHBOARD_WIDGET_IDS.STUDENT_CERTIFICATES]: {
    alwaysVisible: false,
    defaultVisible: false,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.SMALL,
    defaultOrder: 4,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.SMALL, DASHBOARD_WIDGET_WIDTHS.MEDIUM],
    allowedRoles: [SYSTEM_ROLE_SLUGS.STUDENT],
    requiredPermissions: [PERMISSIONS.CERTIFICATE_READ],
  },

  [DASHBOARD_WIDGET_IDS.STUDENT_AI_MENTOR_PRACTICE]: {
    alwaysVisible: false,
    defaultVisible: false,
    defaultWidth: DASHBOARD_WIDGET_WIDTHS.MEDIUM,
    defaultOrder: 5,
    allowedWidths: [DASHBOARD_WIDGET_WIDTHS.MEDIUM],
    allowedRoles: [SYSTEM_ROLE_SLUGS.STUDENT],
    requiredPermissions: [PERMISSIONS.AI_USE],
    requiresAiConfigured: true,
  },
} satisfies DashboardDefinition;
