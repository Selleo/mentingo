export const GAMIFICATION_EVENT_TYPES = {
  LOGIN: "login",
  LESSON_COMPLETED: "lesson_completed",
  COURSE_COMPLETED: "course_completed",
  QUIZ_COMPLETED: "quiz_completed",
} as const;

export type GamificationEventType =
  (typeof GAMIFICATION_EVENT_TYPES)[keyof typeof GAMIFICATION_EVENT_TYPES];

export const ACHIEVEMENT_REQUIREMENT_TYPES = {
  FIRST_TIME: "first_time",
  COUNT: "count",
  STREAK: "streak",
  // Most distinct events within any rolling window of `windowDays` days.
  TIME_WINDOW: "time_window",
} as const;

export type AchievementRequirementType =
  (typeof ACHIEVEMENT_REQUIREMENT_TYPES)[keyof typeof ACHIEVEMENT_REQUIREMENT_TYPES];

export const ACHIEVEMENT_FILTER_KEYS = {
  COURSE_ID: "courseId",
  MIN_SCORE: "minScore",
} as const;

export type AchievementFilterKey =
  (typeof ACHIEVEMENT_FILTER_KEYS)[keyof typeof ACHIEVEMENT_FILTER_KEYS];

/** Filters each event payload can be evaluated against; the API rejects any other filter. */
export const GAMIFICATION_EVENT_FILTERS: Record<GamificationEventType, AchievementFilterKey[]> = {
  [GAMIFICATION_EVENT_TYPES.LOGIN]: [],
  [GAMIFICATION_EVENT_TYPES.LESSON_COMPLETED]: [ACHIEVEMENT_FILTER_KEYS.COURSE_ID],
  [GAMIFICATION_EVENT_TYPES.COURSE_COMPLETED]: [ACHIEVEMENT_FILTER_KEYS.COURSE_ID],
  [GAMIFICATION_EVENT_TYPES.QUIZ_COMPLETED]: [
    ACHIEVEMENT_FILTER_KEYS.COURSE_ID,
    ACHIEVEMENT_FILTER_KEYS.MIN_SCORE,
  ],
};

/** Levels per achievement; level N shows badge tier N unless it has an uploaded badge. */
export const ACHIEVEMENT_MAX_LEVELS = 3;

export const ACHIEVEMENT_MAX_WINDOW_DAYS = 365;
export const ACHIEVEMENT_MAX_XP_REWARD = 100_000;
/** Per translation, for both the title and the description. */
export const ACHIEVEMENT_TEXT_MAX_LENGTH = 500;

/** Icons drawn on the tier badges; uploaded badge images are shown without one. */
export const ACHIEVEMENT_ICONS = {
  TROPHY: "trophy",
  STAR: "star",
  FLAME: "flame",
  ZAP: "zap",
  TARGET: "target",
  AWARD: "award",
  MEDAL: "medal",
  CROWN: "crown",
  ROCKET: "rocket",
  BOOK_OPEN: "book_open",
  GRADUATION_CAP: "graduation_cap",
  LOG_IN: "log_in",
  CALENDAR_CHECK: "calendar_check",
  CLOCK: "clock",
  BRAIN: "brain",
  LIGHTBULB: "lightbulb",
  PUZZLE: "puzzle",
  MESSAGE_CIRCLE: "message_circle",
  HEART: "heart",
  THUMBS_UP: "thumbs_up",
  SPARKLES: "sparkles",
  CIRCLE_CHECK: "circle_check",
} as const;

export type AchievementIcon = (typeof ACHIEVEMENT_ICONS)[keyof typeof ACHIEVEMENT_ICONS];

export const DEFAULT_ACHIEVEMENT_ICON: AchievementIcon = ACHIEVEMENT_ICONS.TROPHY;

export const ACHIEVEMENT_VISIBILITY = {
  VISIBLE: "visible",
  HIDDEN: "hidden",
} as const;

export type AchievementVisibility =
  (typeof ACHIEVEMENT_VISIBILITY)[keyof typeof ACHIEVEMENT_VISIBILITY];

export const XP_TRANSACTION_TYPES = {
  ACHIEVEMENT_LEVEL: "achievement_level",
} as const;

export type XpTransactionType = (typeof XP_TRANSACTION_TYPES)[keyof typeof XP_TRANSACTION_TYPES];

export const XP_PER_LEVEL_FACTOR = 100;

/** XP required to reach level N is XP_PER_LEVEL_FACTOR x (N - 1)^2 (level 2 = 100, level 3 = 400). */
export const getXpRequiredForLevel = (level: number) => XP_PER_LEVEL_FACTOR * (level - 1) ** 2;

export const getLevelFromXp = (lifetimeXp: number) =>
  Math.floor(Math.sqrt(Math.max(lifetimeXp, 0) / XP_PER_LEVEL_FACTOR)) + 1;

/** Upload resource for custom achievement badge images; the API only accepts keys under it. */
export const ACHIEVEMENT_BADGE_FILE_RESOURCE = "achievement-badges";
