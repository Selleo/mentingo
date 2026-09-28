import {
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_VISIBILITY_SCOPES,
  RESOURCE_VISIBILITY,
} from "@repo/shared";
import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import {
  nativeArchiveLanguageSchema,
  nativeArchiveLocalizedTextSchema,
} from "./native-archive-localization.schema";

const nullableStringSchema = Type.Union([Type.String(), Type.Null()]);
const jsonObjectSchema = Type.Record(Type.String(), Type.Unknown());
const liveTrainingSettingsSchema = Type.Object({
  viewerPermissions: Type.Object({
    microphoneEnabled: Type.Boolean(),
    cameraEnabled: Type.Boolean(),
  }),
});

const nativeArchiveLiveTrainingEventSchema = Type.Object({
  title: nativeArchiveLocalizedTextSchema,
  description: Type.Optional(Type.Union([nativeArchiveLocalizedTextSchema, Type.Null()])),
  startsAt: Type.String(),
  endsAt: Type.String(),
  allDay: Type.Boolean(),
  timezone: Type.String(),
  location: Type.Optional(nullableStringSchema),
  rrule: Type.Optional(nullableStringSchema),
  exdates: Type.Optional(Type.Unknown()),
  baseLanguage: nativeArchiveLanguageSchema,
  availableLocales: Type.Array(nativeArchiveLanguageSchema),
});

const nativeArchiveLiveTrainingSchema = Type.Object({
  id: UUIDSchema,
  baseLanguage: nativeArchiveLanguageSchema,
  availableLocales: Type.Array(nativeArchiveLanguageSchema),
  deliveryType: Type.Enum(LIVE_TRAINING_DELIVERY_TYPES),
  visibilityScope: Type.Enum(LIVE_TRAINING_VISIBILITY_SCOPES),
  maxParticipants: Type.Optional(Type.Integer({ minimum: 1 })),
  settings: Type.Optional(liveTrainingSettingsSchema),
  metadata: Type.Optional(jsonObjectSchema),
});

const nativeArchiveResourceSchema = Type.Object({
  title: nativeArchiveLocalizedTextSchema,
  description: nativeArchiveLocalizedTextSchema,
  reference: Type.String(),
  contentType: Type.String(),
  metadata: Type.Optional(Type.Union([jsonObjectSchema, Type.Null()])),
  visibility: Type.Enum(RESOURCE_VISIBILITY),
});

const nativeArchiveLiveTrainingMaterialSchema = Type.Object({
  relationshipType: Type.String(),
  resource: nativeArchiveResourceSchema,
});

export const nativeArchiveLiveTrainingLessonSchema = Type.Object({
  lessonId: UUIDSchema,
  language: nativeArchiveLanguageSchema,
  training: nativeArchiveLiveTrainingSchema,
  event: nativeArchiveLiveTrainingEventSchema,
  materials: Type.Array(nativeArchiveLiveTrainingMaterialSchema),
});

export const nativeArchiveLiveTrainingLessonsSchema = Type.Array(
  nativeArchiveLiveTrainingLessonSchema,
);

export type NativeArchiveLiveTrainingLesson = Static<typeof nativeArchiveLiveTrainingLessonSchema>;
