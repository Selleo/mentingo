export type AchievementLevel = {
  id: string;
  levelNumber: number;
  threshold: number;
  xpReward: number;
  achievementName: string;
};

export const GAMIFICATION_WEBSOCKET_EMIT_TITLE = {
  NEW_LEVEL: "gamification:newLevel",
} as const;

export const GAMIFICATION_WEBSOCKET_EMIT_TYPE = {
  ACHIEVEMENT: "achievement",
} as const;
