import { GAMIFICATION_VISIBILITY, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const achievementsLanguageSchema = Type.Enum(SUPPORTED_LANGUAGES);

export const UserAchievementSchema = Type.Object({
  achievementId: Type.String({ format: "uuid" }),
  achievementTitle: Type.String(),

  visibility: Type.Union([
    Type.Literal(GAMIFICATION_VISIBILITY.VISIBLE),
    Type.Literal(GAMIFICATION_VISIBILITY.HIDDEN),
  ]),

  levelId: Type.String({ format: "uuid" }),
  levelNumber: Type.Number(),
  threshold: Type.Number(),
  xpReward: Type.Number(),

  earnedAt: Type.String({ format: "date-time" }),
});

export const GetUserAchievementsSchema = Type.Array(UserAchievementSchema);

export type UserAchievement = Static<typeof UserAchievementSchema>;
export type GetUserAchievements = Static<typeof GetUserAchievementsSchema>;
