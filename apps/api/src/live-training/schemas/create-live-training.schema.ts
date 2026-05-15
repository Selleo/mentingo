import { LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema, baseResponse } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import {
  liveTrainingDeliveryTypeSchema,
  updateLiveTrainingSettingsSchema,
} from "./live-training-common.schema";
import { liveTrainingDetailsSchema } from "./live-training-details.schema";

export const createLiveTrainingSchema = Type.Object({
  language: supportedLanguagesSchema,
  title: Type.String({ minLength: 1 }),
  description: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
  startsAt: Type.String({ minLength: 1 }),
  endsAt: Type.String({ minLength: 1 }),
  timezone: Type.String({ minLength: 1 }),
  location: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  deliveryType: liveTrainingDeliveryTypeSchema,
  maxParticipants: Type.Optional(
    Type.Number({ minimum: 1, maximum: LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT }),
  ),
  settings: Type.Optional(updateLiveTrainingSettingsSchema),
  trainerUserIds: Type.Optional(Type.Array(UUIDSchema)),
  linkedCourseIds: Type.Optional(Type.Array(UUIDSchema)),
  beforeResourceIds: Type.Optional(Type.Array(UUIDSchema)),
  afterResourceIds: Type.Optional(Type.Array(UUIDSchema)),
});

export const createLiveTrainingResponseSchema = baseResponse(liveTrainingDetailsSchema);

export type CreateLiveTrainingBody = Static<typeof createLiveTrainingSchema>;
export type CreateLiveTrainingResponse = Static<typeof createLiveTrainingResponseSchema>;
