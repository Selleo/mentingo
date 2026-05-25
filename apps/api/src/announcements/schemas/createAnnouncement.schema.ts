import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import { announcementLanguageSchema } from "./announcement.schema";

export const createAnnouncementTranslationSchema = Type.Object({
  language: announcementLanguageSchema,
  title: Type.String({ minLength: 1, maxLength: 120 }),
  content: Type.String({ minLength: 1 }),
});

export const createAnnouncementSchema = Type.Object({
  groupId: Type.Union([UUIDSchema, Type.Null()], { default: null }),
  baseLanguage: announcementLanguageSchema,
  translations: Type.Array(createAnnouncementTranslationSchema, { minItems: 1 }),
});
