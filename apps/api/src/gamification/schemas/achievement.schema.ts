import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

const achievementTranslationInputSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  description: Type.String({ minLength: 1 }),
});

export const achievementTranslationsInputSchema = Type.Object({
  [SUPPORTED_LANGUAGES.EN]: achievementTranslationInputSchema,
  [SUPPORTED_LANGUAGES.PL]: achievementTranslationInputSchema,
  [SUPPORTED_LANGUAGES.DE]: achievementTranslationInputSchema,
  [SUPPORTED_LANGUAGES.LT]: achievementTranslationInputSchema,
  [SUPPORTED_LANGUAGES.CS]: achievementTranslationInputSchema,
});

export const achievementTranslationSchema = Type.Object({
  locale: Type.Enum(SUPPORTED_LANGUAGES),
  name: Type.String(),
  description: Type.String(),
});

export const achievementSchema = Type.Object({
  id: UUIDSchema,
  tenantId: UUIDSchema,
  imageReference: Type.String(),
  imageUrl: Type.Optional(Type.String()),
  pointThreshold: Type.Integer({ minimum: 1 }),
  isActive: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  localizedName: Type.String(),
  localizedDescription: Type.String(),
  translations: Type.Array(achievementTranslationSchema),
});

export const achievementsListSchema = Type.Array(achievementSchema);

export const createAchievementSchema = Type.Object({
  imageReference: Type.String({ minLength: 1 }),
  pointThreshold: Type.Integer({ minimum: 1 }),
  isActive: Type.Optional(Type.Boolean()),
  translations: achievementTranslationsInputSchema,
});

export const updateAchievementSchema = Type.Partial(
  Type.Object({
    imageReference: Type.String({ minLength: 1 }),
    pointThreshold: Type.Integer({ minimum: 1 }),
    isActive: Type.Boolean(),
    translations: achievementTranslationsInputSchema,
  }),
  { minProperties: 1 },
);

export const achievementImageUploadResponseSchema = Type.Object({
  fileKey: Type.String(),
  fileUrl: Type.Optional(Type.String()),
});

export type Achievement = Static<typeof achievementSchema>;
export type CreateAchievementBody = Static<typeof createAchievementSchema>;
export type UpdateAchievementBody = Static<typeof updateAchievementSchema>;
export type AchievementTranslationsInput = Static<typeof achievementTranslationsInputSchema>;
export type AchievementImageUploadResponse = Static<typeof achievementImageUploadResponseSchema>;
