import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { type Static, Type } from "@sinclair/typebox";

import { chapterSchema, showChapterSchema } from "src/chapter/schemas/chapter.schema";
import { UUIDSchema } from "src/common";

import { coursesStatusOptions } from "./courseQuery";

export const commonShowCourseSchema = Type.Object({
  archived: Type.Optional(Type.Boolean()),
  authorId: Type.Optional(UUIDSchema),
  category: Type.String(),
  categoryId: Type.Optional(Type.String({ format: "uuid" })),
  chapters: Type.Array(showChapterSchema),
  completedChapterCount: Type.Optional(Type.Number()),
  courseChapterCount: Type.Number(),
  currency: Type.String(),
  description: Type.String(),
  enrolled: Type.Optional(Type.Boolean()),
  hasFreeChapter: Type.Optional(Type.Boolean()),
  hasCertificate: Type.Optional(Type.Boolean()),
  id: Type.String({ format: "uuid" }),
  status: coursesStatusOptions,
  isScorm: Type.Optional(Type.Boolean()),
  priceInCents: Type.Number(),
  thumbnailUrl: Type.Optional(Type.String()),
  trailerUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  title: Type.String(),
  slug: Type.String(),
  stripeProductId: Type.Union([Type.String(), Type.Null()]),
  stripePriceId: Type.Union([Type.String(), Type.Null()]),
  availableLocales: Type.Array(Type.Enum(SUPPORTED_LANGUAGES)),
  baseLanguage: Type.Enum(SUPPORTED_LANGUAGES),
  dueDate: Type.Union([Type.String(), Type.Null()]),
});

export const commonShowBetaCourseSchema = Type.Object({
  archived: Type.Optional(Type.Boolean()),
  authorId: Type.Optional(UUIDSchema),
  category: Type.String(),
  categoryId: Type.Optional(Type.String({ format: "uuid" })),
  chapters: Type.Array(chapterSchema),
  completedChapterCount: Type.Optional(Type.Number()),
  courseChapterCount: Type.Number(),
  currency: Type.String(),
  description: Type.String(),
  enrolled: Type.Optional(Type.Boolean()),
  hasFreeChapter: Type.Optional(Type.Boolean()),
  hasCertificate: Type.Optional(Type.Boolean()),
  id: Type.String({ format: "uuid" }),
  status: coursesStatusOptions,
  isScorm: Type.Optional(Type.Boolean()),
  priceInCents: Type.Number(),
  thumbnailUrl: Type.Optional(Type.String()),
  thumbnailS3Key: Type.Optional(Type.String()),
  thumbnailS3SingedUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  trailerUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  title: Type.String(),
  availableLocales: Type.Array(Type.Enum(SUPPORTED_LANGUAGES)),
  baseLanguage: Type.Enum(SUPPORTED_LANGUAGES),
});

export type CommonShowCourse = Static<typeof commonShowCourseSchema>;
export type CommonShowBetaCourse = Static<typeof commonShowBetaCourseSchema>;
