import { SYSTEM_ROLE_SLUGS, type SystemRoleSlug } from "./permissions";

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
  DOOR_OPEN: "door_open",
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
  GEM: "gem",
  DIAMOND: "diamond",
  SHIELD_CHECK: "shield_check",
  BADGE_CHECK: "badge_check",
  FLAG: "flag",
  MOUNTAIN: "mountain",
  FOOTPRINTS: "footprints",
  GAUGE: "gauge",
  TIMER: "timer",
  HOURGLASS: "hourglass",
  ALARM_CLOCK: "alarm_clock",
  CALENDAR_DAYS: "calendar_days",
  SUNRISE: "sunrise",
  SUN: "sun",
  MOON: "moon",
  COFFEE: "coffee",
  BOOK: "book",
  LIBRARY: "library",
  NOTEBOOK_PEN: "notebook_pen",
  PENCIL: "pencil",
  CLIPBOARD_CHECK: "clipboard_check",
  LIST_CHECKS: "list_checks",
  CHECK_CHECK: "check_check",
  GLASSES: "glasses",
  MICROSCOPE: "microscope",
  FLASK_CONICAL: "flask_conical",
  ATOM: "atom",
  CALCULATOR: "calculator",
  LANGUAGES: "languages",
  GLOBE: "globe",
  COMPASS: "compass",
  MAP: "map",
  ROUTE: "route",
  TELESCOPE: "telescope",
  HEADPHONES: "headphones",
  MIC: "mic",
  PALETTE: "palette",
  USERS: "users",
  HANDSHAKE: "handshake",
  SMILE: "smile",
  PARTY_POPPER: "party_popper",
  GIFT: "gift",
  SPROUT: "sprout",
  LEAF: "leaf",
  INFINITY: "infinity",
  REPEAT: "repeat",
  TRENDING_UP: "trending_up",
  ACTIVITY: "activity",
  DUMBBELL: "dumbbell",
  GAMEPAD_2: "gamepad_2",
  KEY: "key",
  ANCHOR: "anchor",
  PLANE: "plane",
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

export const LEADERBOARD_METRICS = {
  XP: "xp",
  ACHIEVEMENTS: "achievements",
} as const;

export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[keyof typeof LEADERBOARD_METRICS];

export const LEADERBOARD_PERIODS = {
  WEEK: "week",
  MONTH: "month",
  ALL_TIME: "all_time",
  CUSTOM: "custom",
} as const;

export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[keyof typeof LEADERBOARD_PERIODS];

/** Closed: learners see only their groups' leaderboards. Public: also the organization-wide one. */
export const LEADERBOARD_VISIBILITY = {
  CLOSED: "closed",
  PUBLIC: "public",
} as const;

export type LeaderboardVisibility =
  (typeof LEADERBOARD_VISIBILITY)[keyof typeof LEADERBOARD_VISIBILITY];

/** Users with any of these roles are never ranked. Add the reviewer role here once it exists. */
export const LEADERBOARD_EXCLUDED_ROLE_SLUGS = [
  SYSTEM_ROLE_SLUGS.ADMIN,
  SYSTEM_ROLE_SLUGS.TRAINER,
  SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
] as const satisfies readonly SystemRoleSlug[];
