import { FEATURES, type FeatureKey } from "./features";
import {
  PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  type PermissionKey,
  type SystemRoleSlug,
} from "./permissions";

/** Stable widget identifiers shared by every user role. */
export const DASHBOARD_WIDGET_TYPES = {
  AI_MENTOR_PRACTICE: "ai_mentor_practice",
  TODO_LIST: "todo_list",
  EVENT_CALENDAR: "event_calendar",
  DEADLINE_RISKS: "deadline_risks",
  TRAINING_COMPLETION: "training_completion",
  CONTINUE_LEARNING: "continue_learning",
  REQUIRED_COURSES: "required_courses",
  COURSE_COMPLETION: "course_completion",
  CERTIFICATES: "certificates",
} as const;

export type DashboardWidgetType =
  (typeof DASHBOARD_WIDGET_TYPES)[keyof typeof DASHBOARD_WIDGET_TYPES];

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

export type DashboardWidgetDefinition = {
  type: DashboardWidgetType;
  /** Required widgets are always visible and cannot be disabled by the user. */
  alwaysVisible: boolean;
  allowedSizes: readonly DashboardWidgetSize[];
  defaultSize: DashboardWidgetSize;
  requiredPermissions?: readonly PermissionKey[];
  anyPermissions?: readonly PermissionKey[];
  requiredFeature?: FeatureKey;
  requiresAiConfigured?: boolean;
};

export type DashboardWidgetCatalogEntry = DashboardWidgetDefinition & {
  allowedSizes: DashboardWidgetSize[];
};

export type DashboardLayoutWidget = {
  type: DashboardWidgetType;
  size: DashboardWidgetSize;
  visible: boolean;
};

export const DASHBOARD_SCHEMA_VERSION = 2 as const;

export type DashboardSettings = {
  schemaVersion: typeof DASHBOARD_SCHEMA_VERSION;
  revision: number;
  widgets: DashboardLayoutWidget[];
};

export const DASHBOARD_WIDGET_CATALOG = {
  [DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE]: {
    type: DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE,
    alwaysVisible: false,
    allowedSizes: [DASHBOARD_WIDGET_SIZES.TWO_BY_TWO, DASHBOARD_WIDGET_SIZES.THREE_BY_TWO],
    defaultSize: DASHBOARD_WIDGET_SIZES.THREE_BY_TWO,
    requiredPermissions: [PERMISSIONS.AI_USE],
    requiresAiConfigured: true,
  },
  [DASHBOARD_WIDGET_TYPES.TODO_LIST]: {
    type: DASHBOARD_WIDGET_TYPES.TODO_LIST,
    alwaysVisible: false,
    allowedSizes: [
      DASHBOARD_WIDGET_SIZES.TWO_BY_ONE,
      DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
      DASHBOARD_WIDGET_SIZES.THREE_BY_TWO,
    ],
    defaultSize: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
    requiredPermissions: [PERMISSIONS.TODO_TASK_MANAGE_SELF],
  },
  [DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR]: {
    type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
    alwaysVisible: true,
    allowedSizes: [DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO, DASHBOARD_WIDGET_SIZES.FOUR_BY_THREE],
    defaultSize: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO,
    requiredPermissions: [PERMISSIONS.CALENDAR_READ],
    requiredFeature: FEATURES.CALENDAR,
  },
  [DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS]: {
    type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS,
    alwaysVisible: false,
    allowedSizes: [
      DASHBOARD_WIDGET_SIZES.TWO_BY_ONE,
      DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
      DASHBOARD_WIDGET_SIZES.THREE_BY_TWO,
    ],
    defaultSize: DASHBOARD_WIDGET_SIZES.TWO_BY_ONE,
    anyPermissions: [PERMISSIONS.STATISTICS_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ],
  },
  [DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION]: {
    type: DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION,
    alwaysVisible: false,
    allowedSizes: [DASHBOARD_WIDGET_SIZES.ONE_BY_ONE, DASHBOARD_WIDGET_SIZES.TWO_BY_TWO],
    defaultSize: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
    anyPermissions: [PERMISSIONS.STATISTICS_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ],
  },
  [DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING]: {
    type: DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING,
    alwaysVisible: false,
    allowedSizes: [
      DASHBOARD_WIDGET_SIZES.TWO_BY_ONE,
      DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
      DASHBOARD_WIDGET_SIZES.THREE_BY_TWO,
    ],
    defaultSize: DASHBOARD_WIDGET_SIZES.TWO_BY_ONE,
    requiredPermissions: [PERMISSIONS.COURSE_READ_ASSIGNED],
  },
  [DASHBOARD_WIDGET_TYPES.REQUIRED_COURSES]: {
    type: DASHBOARD_WIDGET_TYPES.REQUIRED_COURSES,
    alwaysVisible: false,
    allowedSizes: [
      DASHBOARD_WIDGET_SIZES.TWO_BY_ONE,
      DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
      DASHBOARD_WIDGET_SIZES.THREE_BY_TWO,
    ],
    defaultSize: DASHBOARD_WIDGET_SIZES.TWO_BY_ONE,
    requiredPermissions: [PERMISSIONS.COURSE_READ_ASSIGNED],
  },
  [DASHBOARD_WIDGET_TYPES.COURSE_COMPLETION]: {
    type: DASHBOARD_WIDGET_TYPES.COURSE_COMPLETION,
    alwaysVisible: false,
    allowedSizes: [DASHBOARD_WIDGET_SIZES.ONE_BY_ONE, DASHBOARD_WIDGET_SIZES.TWO_BY_TWO],
    defaultSize: DASHBOARD_WIDGET_SIZES.ONE_BY_ONE,
    requiredPermissions: [PERMISSIONS.COURSE_READ_ASSIGNED],
  },
  [DASHBOARD_WIDGET_TYPES.CERTIFICATES]: {
    type: DASHBOARD_WIDGET_TYPES.CERTIFICATES,
    alwaysVisible: false,
    allowedSizes: [DASHBOARD_WIDGET_SIZES.TWO_BY_ONE, DASHBOARD_WIDGET_SIZES.TWO_BY_TWO],
    defaultSize: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
    requiredPermissions: [PERMISSIONS.CERTIFICATE_READ],
  },
} satisfies Record<DashboardWidgetType, DashboardWidgetDefinition>;

export type DashboardCatalog = typeof DASHBOARD_WIDGET_CATALOG;

export type DashboardDefaultLayoutWidget = Pick<DashboardLayoutWidget, "type" | "size">;

/** Role-derived defaults define the restored order and size; permission checks remain authoritative. */
export const DASHBOARD_DEFAULT_LAYOUTS: Record<
  SystemRoleSlug,
  readonly DashboardDefaultLayoutWidget[]
> = {
  [SYSTEM_ROLE_SLUGS.GROUP_MANAGER]: [
    { type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR, size: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO },
    { type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS, size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO },
    {
      type: DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION,
      size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
    },
  ],
  [SYSTEM_ROLE_SLUGS.ADMIN]: [
    { type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS, size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO },
    { type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR, size: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO },
    {
      type: DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION,
      size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
    },
    {
      type: DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE,
      size: DASHBOARD_WIDGET_SIZES.THREE_BY_TWO,
    },
    { type: DASHBOARD_WIDGET_TYPES.TODO_LIST, size: DASHBOARD_WIDGET_SIZES.THREE_BY_TWO },
  ],
  [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]: [
    { type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS, size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO },
    { type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR, size: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO },
    {
      type: DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION,
      size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
    },
    {
      type: DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE,
      size: DASHBOARD_WIDGET_SIZES.THREE_BY_TWO,
    },
    { type: DASHBOARD_WIDGET_TYPES.TODO_LIST, size: DASHBOARD_WIDGET_SIZES.THREE_BY_TWO },
  ],
  [SYSTEM_ROLE_SLUGS.TRAINER]: [
    {
      type: DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE,
      size: DASHBOARD_WIDGET_SIZES.THREE_BY_TWO,
    },
    { type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR, size: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO },
    { type: DASHBOARD_WIDGET_TYPES.TODO_LIST, size: DASHBOARD_WIDGET_SIZES.THREE_BY_TWO },
  ],
  [SYSTEM_ROLE_SLUGS.STUDENT]: [
    {
      type: DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING,
      size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
    },
    {
      type: DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE,
      size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
    },
    { type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR, size: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO },
    { type: DASHBOARD_WIDGET_TYPES.TODO_LIST, size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO },
    {
      type: DASHBOARD_WIDGET_TYPES.REQUIRED_COURSES,
      size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
    },
    {
      type: DASHBOARD_WIDGET_TYPES.COURSE_COMPLETION,
      size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
    },
    { type: DASHBOARD_WIDGET_TYPES.CERTIFICATES, size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO },
  ],
};

export const STUDENT_DASHBOARD_LIMITS = {
  CONTINUE_COURSES: 5,
  REQUIRED_COURSES: 5,
} as const;

export const DASHBOARD_CALENDAR_VIEWS = {
  ALL: "all",
  UPCOMING: "upcoming",
} as const;

export type DashboardCalendarView =
  (typeof DASHBOARD_CALENDAR_VIEWS)[keyof typeof DASHBOARD_CALENDAR_VIEWS];

export const STUDENT_COURSE_URGENCY = {
  OVERDUE: "overdue",
  DUE_SOON: "dueSoon",
  SCHEDULED: "scheduled",
  NO_DEADLINE: "noDeadline",
} as const;

export type StudentCourseUrgency =
  (typeof STUDENT_COURSE_URGENCY)[keyof typeof STUDENT_COURSE_URGENCY];

export const DASHBOARD_DEADLINE_RISK_TYPES = {
  OVERDUE: "overdue",
  DUE_SOON: "dueSoon",
} as const;

export type DashboardDeadlineRiskType =
  (typeof DASHBOARD_DEADLINE_RISK_TYPES)[keyof typeof DASHBOARD_DEADLINE_RISK_TYPES];

export const DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS = {
  MOST_URGENT: "mostUrgent",
  LEAST_URGENT: "leastUrgent",
} as const;

export type DashboardDeadlineRiskUrgencyOrder =
  (typeof DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS)[keyof typeof DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS];

export const DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS = {
  NAME: "name",
  DUE_DATE: "dueDate",
  URGENCY: "urgency",
  STUDENT_COUNT: "studentCount",
} as const;

export type DashboardDeadlineRiskGroupSortField =
  (typeof DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS)[keyof typeof DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS];

export const DASHBOARD_DEADLINE_RISK_SORT_DIRECTIONS = {
  ASC: "asc",
  DESC: "desc",
} as const;

export type DashboardDeadlineRiskSortDirection =
  (typeof DASHBOARD_DEADLINE_RISK_SORT_DIRECTIONS)[keyof typeof DASHBOARD_DEADLINE_RISK_SORT_DIRECTIONS];
