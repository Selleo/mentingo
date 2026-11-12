export const GAMIFICATION_FEATURES = {
  GAMIFICATION: "gamification",
  LEADERBOARDS: "leaderboards",
} as const;

export type GamificationFeature =
  (typeof GAMIFICATION_FEATURES)[keyof typeof GAMIFICATION_FEATURES];
