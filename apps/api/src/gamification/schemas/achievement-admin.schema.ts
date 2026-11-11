import {
  ACHIEVEMENT_ICONS,
  ACHIEVEMENT_MAX_LEVELS,
  ACHIEVEMENT_MAX_WINDOW_DAYS,
  ACHIEVEMENT_MAX_XP_REWARD,
  ACHIEVEMENT_TEXT_MAX_LENGTH,
  ACHIEVEMENT_REQUIREMENT_TYPES,
  ACHIEVEMENT_VISIBILITY,
  GAMIFICATION_EVENT_TYPES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

const localizedTextSchema = Type.Partial(
  Type.Record(
    Type.Enum(SUPPORTED_LANGUAGES),
    Type.String({ maxLength: ACHIEVEMENT_TEXT_MAX_LENGTH }),
  ),
);

export const achievementFiltersSchema = Type.Object(
  {
    courseId: Type.Optional(UUIDSchema),
    minScore: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  },
  { additionalProperties: false },
);

export const achievementLevelInputSchema = Type.Object({
  threshold: Type.Integer({ minimum: 1 }),
  xpReward: Type.Integer({ minimum: 0, maximum: ACHIEVEMENT_MAX_XP_REWARD }),
  badgeImageKey: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
});

export const upsertAchievementSchema = Type.Object({
  title: localizedTextSchema,
  description: localizedTextSchema,
  baseLanguage: Type.Enum(SUPPORTED_LANGUAGES),
  eventType: Type.Enum(GAMIFICATION_EVENT_TYPES),
  requirementType: Type.Enum(ACHIEVEMENT_REQUIREMENT_TYPES),
  windowDays: Type.Union([
    Type.Integer({ minimum: 1, maximum: ACHIEVEMENT_MAX_WINDOW_DAYS }),
    Type.Null(),
  ]),
  filters: achievementFiltersSchema,
  visibility: Type.Enum(ACHIEVEMENT_VISIBILITY),
  icon: Type.Enum(ACHIEVEMENT_ICONS),
  isEnabled: Type.Boolean(),
  levels: Type.Array(achievementLevelInputSchema, {
    minItems: 1,
    maxItems: ACHIEVEMENT_MAX_LEVELS,
  }),
});

export const updateAchievementStatusSchema = Type.Object({
  isEnabled: Type.Boolean(),
});

const adminAchievementLevelSchema = Type.Object({
  level: Type.Integer({ minimum: 1 }),
  threshold: Type.Integer({ minimum: 1 }),
  xpReward: Type.Integer({ minimum: 0 }),
  earnedCount: Type.Integer({ minimum: 0 }),
  badgeImageKey: Type.Union([Type.String(), Type.Null()]),
  badgeImageUrl: Type.Union([Type.String(), Type.Null()]),
});

export const adminAchievementSchema = Type.Object({
  id: UUIDSchema,
  isPredefined: Type.Boolean(),
  title: Type.String(),
  description: Type.String(),
  eventType: Type.Enum(GAMIFICATION_EVENT_TYPES),
  requirementType: Type.Enum(ACHIEVEMENT_REQUIREMENT_TYPES),
  windowDays: Type.Union([Type.Integer(), Type.Null()]),
  filters: achievementFiltersSchema,
  visibility: Type.Enum(ACHIEVEMENT_VISIBILITY),
  icon: Type.Enum(ACHIEVEMENT_ICONS),
  isEnabled: Type.Boolean(),
  levels: Type.Array(adminAchievementLevelSchema),
});

export const adminAchievementDetailsSchema = Type.Composite([
  Type.Omit(adminAchievementSchema, ["title", "description"]),
  Type.Object({
    title: localizedTextSchema,
    description: localizedTextSchema,
    baseLanguage: Type.Enum(SUPPORTED_LANGUAGES),
  }),
]);

export const createAchievementResponseSchema = Type.Object({ id: UUIDSchema });
export const achievementMessageResponseSchema = Type.Object({ message: Type.String() });

export type UpsertAchievementBody = Static<typeof upsertAchievementSchema>;
export type UpdateAchievementStatusBody = Static<typeof updateAchievementStatusSchema>;
export type AdminAchievement = Static<typeof adminAchievementSchema>;
export type AdminAchievementDetails = Static<typeof adminAchievementDetailsSchema>;
export type CreateAchievementResponse = Static<typeof createAchievementResponseSchema>;
export type AchievementMessageResponse = Static<typeof achievementMessageResponseSchema>;
