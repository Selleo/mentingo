import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const createAchievementLevelSchema = Type.Object({
  threshold: Type.Integer(),
  xpReward: Type.Integer(),
});

export type CreateAchievementLevel = Static<typeof createAchievementLevelSchema>;
