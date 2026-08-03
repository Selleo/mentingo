import { GAMIFICATION_VISIBILITY } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { achievementsLanguageSchema } from "./achievements.schema";

import type { Static } from "@sinclair/typebox";

export const updateAchievementSchema = Type.Partial(
  Type.Object({
    title: Type.String(),
    language: achievementsLanguageSchema,
    visibility: Type.Union([
      Type.Literal(GAMIFICATION_VISIBILITY.VISIBLE),
      Type.Literal(GAMIFICATION_VISIBILITY.HIDDEN),
    ]),
    isEnabled: Type.Boolean(),
    triggerEventType: Type.String(),
  }),
);

export type UpdateAchievement = Static<typeof updateAchievementSchema>;
