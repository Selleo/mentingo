import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import {
  nativeArchiveLanguageSchema,
  nativeArchiveLocalizedTextSchema,
} from "./native-archive-localization.schema";

const nullableStringSchema = Type.Union([Type.String(), Type.Null()]);

export const nativeArchiveLearningPathLanguageSchema = Type.Object({
  baseLanguage: nativeArchiveLanguageSchema,
  availableLocales: Type.Array(nativeArchiveLanguageSchema),
});

export const nativeArchiveLearningPathSchema = Type.Object({
  id: UUIDSchema,
  title: nativeArchiveLocalizedTextSchema,
  description: nativeArchiveLocalizedTextSchema,
  thumbnailReference: nullableStringSchema,
  includesCertificate: Type.Boolean(),
  settings: Type.Object({
    certificateSignature: nullableStringSchema,
    certificateFontColor: nullableStringSchema,
  }),
  sequenceEnabled: Type.Boolean(),
  baseLanguage: nativeArchiveLanguageSchema,
  availableLocales: Type.Array(nativeArchiveLanguageSchema),
  courseLinks: Type.Array(
    Type.Object({
      courseId: UUIDSchema,
      displayOrder: Type.Integer(),
    }),
  ),
});

export type NativeArchiveLearningPath = Static<typeof nativeArchiveLearningPathSchema>;
