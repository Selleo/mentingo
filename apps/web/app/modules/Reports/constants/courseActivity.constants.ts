import type {
  ActivitySubject,
  ActivitySubjectLabelKeys,
  InactivityLevel,
  RollingActivityPeriodPreset,
} from "../types/courseActivity.types";

export const ACTIVITY_PERIOD_PRESETS = {
  LAST_7_DAYS: "last7Days",
  LAST_30_DAYS: "last30Days",
  LAST_90_DAYS: "last90Days",
  CUSTOM: "custom",
} as const;

export const ROLLING_PERIOD_PRESET_DAYS: Record<RollingActivityPeriodPreset, number> = {
  [ACTIVITY_PERIOD_PRESETS.LAST_7_DAYS]: 7,
  [ACTIVITY_PERIOD_PRESETS.LAST_30_DAYS]: 30,
  [ACTIVITY_PERIOD_PRESETS.LAST_90_DAYS]: 90,
};

export const INACTIVITY_LEVELS = {
  RECENT: "recent",
  STALE: "stale",
  DORMANT: "dormant",
} as const;

export const INACTIVITY_LEVEL_THRESHOLD_DAYS = { STALE: 30, DORMANT: 90 } as const;

export const INACTIVITY_LEVEL_COLORS: Record<InactivityLevel, string> = {
  [INACTIVITY_LEVELS.RECENT]: "var(--success-500)",
  [INACTIVITY_LEVELS.STALE]: "var(--warning-500)",
  [INACTIVITY_LEVELS.DORMANT]: "var(--error-500)",
};

export const COURSE_ACTIVITY_CHART = {
  BAR_ROW_HEIGHT: 40,
  PADDING: 24,
  LABEL_MAX_LENGTH: 20,
  LABEL_WIDTH: 176,
} as const;

export const CALENDAR_DATE_TIMEZONE = "UTC";

export const ACTIVITY_SUBJECTS = {
  COURSE: "course",
  PATH: "path",
} as const;

export const ACTIVITY_SUBJECT_LABEL_KEYS: Record<ActivitySubject, ActivitySubjectLabelKeys> = {
  [ACTIVITY_SUBJECTS.COURSE]: {
    title: "reports.activity.title",
    popular: "reports.activity.popular",
    inactive: "reports.activity.inactive",
    topSubject: "reports.activity.highlights.topCourse",
    neverActive: "reports.activity.highlights.neverActive",
  },
  [ACTIVITY_SUBJECTS.PATH]: {
    title: "reports.pathActivity.title",
    popular: "reports.pathActivity.popular",
    inactive: "reports.pathActivity.inactive",
    topSubject: "reports.pathActivity.topPath",
    neverActive: "reports.pathActivity.neverActive",
  },
};
