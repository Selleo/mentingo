import { LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema, baseResponse } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import {
  liveTrainingDeliveryTypeSchema,
  liveTrainingStatusSchema,
  updateLiveTrainingSettingsSchema,
} from "./live-training-common.schema";
import { liveTrainingDetailsSchema } from "./live-training-details.schema";

export const updateLiveTrainingSchema = Type.Intersect([
  Type.Object({
    language: supportedLanguagesSchema,
  }),
  Type.Partial(
    Type.Object({
      title: Type.String({ minLength: 1 }),
      description: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
      startsAt: Type.String({ minLength: 1 }),
      endsAt: Type.String({ minLength: 1 }),
      timezone: Type.String({ minLength: 1 }),
      location: Type.Union([Type.String(), Type.Null()]),
      deliveryType: liveTrainingDeliveryTypeSchema,
      status: liveTrainingStatusSchema,
      maxParticipants: Type.Number({ minimum: 1, maximum: LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT }),
      settings: updateLiveTrainingSettingsSchema,
      trainerUserIds: Type.Array(UUIDSchema),
      linkedCourseIds: Type.Array(UUIDSchema),
      beforeResourceIds: Type.Array(UUIDSchema),
      afterResourceIds: Type.Array(UUIDSchema),
    }),
  ),
]);

export const updateLiveTrainingResponseSchema = baseResponse(liveTrainingDetailsSchema);

export type UpdateLiveTrainingBody = Static<typeof updateLiveTrainingSchema>;
export type UpdateLiveTrainingResponse = Static<typeof updateLiveTrainingResponseSchema>;
