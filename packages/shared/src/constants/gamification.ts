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
} as const;

export type AchievementRequirementType =
  (typeof ACHIEVEMENT_REQUIREMENT_TYPES)[keyof typeof ACHIEVEMENT_REQUIREMENT_TYPES];

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
