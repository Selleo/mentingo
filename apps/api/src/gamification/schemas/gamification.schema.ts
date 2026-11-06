import {
  ACHIEVEMENT_REQUIREMENT_TYPES,
  ACHIEVEMENT_VISIBILITY,
  GAMIFICATION_EVENT_TYPES,
} from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const achievementLevelProgressSchema = Type.Object({
  level: Type.Integer({ minimum: 1 }),
  threshold: Type.Integer({ minimum: 1 }),
  xpReward: Type.Integer({ minimum: 0 }),
  earnedAt: Type.Union([Type.String(), Type.Null()]),
});

export const userAchievementSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  description: Type.String(),
  eventType: Type.Enum(GAMIFICATION_EVENT_TYPES),
  requirementType: Type.Enum(ACHIEVEMENT_REQUIREMENT_TYPES),
  visibility: Type.Enum(ACHIEVEMENT_VISIBILITY),
  progress: Type.Integer({ minimum: 0 }),
  levels: Type.Array(achievementLevelProgressSchema),
});

export const recentRewardSchema = Type.Object({
  id: UUIDSchema,
  achievementId: UUIDSchema,
  achievementTitle: Type.String(),
  level: Type.Integer({ minimum: 1 }),
  xpReward: Type.Integer({ minimum: 0 }),
  earnedAt: Type.String(),
});

export const userGamificationProfileSchema = Type.Object({
  userId: UUIDSchema,
  lifetimeXp: Type.Integer({ minimum: 0 }),
  spendableXp: Type.Integer({ minimum: 0 }),
  level: Type.Integer({ minimum: 1 }),
  currentLevelXp: Type.Integer({ minimum: 0 }),
  nextLevelXp: Type.Integer({ minimum: 0 }),
  achievements: Type.Array(userAchievementSchema),
  recentRewards: Type.Array(recentRewardSchema),
});

export type UserAchievement = Static<typeof userAchievementSchema>;
export type RecentReward = Static<typeof recentRewardSchema>;
export type UserGamificationProfileResponse = Static<typeof userGamificationProfileSchema>;
