export const GAMIFICATION_VISIBILITY = {
  VISIBLE: "visible",
  HIDDEN: "hidden",
} as const;

export type GamificationVisibility =
  (typeof GAMIFICATION_VISIBILITY)[keyof typeof GAMIFICATION_VISIBILITY];

export const GAMIFICATION_SOURCE_TYPE = {
  ACTIVITY_LOG: "activity_log",
  OUTBOX_EVENT: "outbox_event",
} as const;

export type GamificationSourceType =
  (typeof GAMIFICATION_SOURCE_TYPE)[keyof typeof GAMIFICATION_SOURCE_TYPE];

export const CHALLENGE_PERIOD_TYPE = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  ONE_TIME: "one_time",
} as const;

export type ChallengePeriodType =
  (typeof CHALLENGE_PERIOD_TYPE)[keyof typeof CHALLENGE_PERIOD_TYPE];

export const CHALLENGE_STATUS = {
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
} as const;

export type ChallengeStatus = (typeof CHALLENGE_STATUS)[keyof typeof CHALLENGE_STATUS];

export const XP_TRANSACTION_TYPE = {
  ACHIEVEMENT_REWARD: "achievement_reward",
  CHALLENGE_REWARD: "challenge_reward",
  SHOP_SPEND: "shop_spend",
} as const;

export type XpTransactionType = (typeof XP_TRANSACTION_TYPE)[keyof typeof XP_TRANSACTION_TYPE];
