import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const updateAchievementLevelSchema = Type.Partial(
  Type.Object({
    threshold: Type.Integer(),
    xpReward: Type.Integer(),
  }),
);

export type UpdateAchievementLevel = Static<typeof updateAchievementLevelSchema>;

export const levelNumberParamSchema = Type.Number({ minimum: 1 });

export type LevelNumberParam = Static<typeof levelNumberParamSchema>;
