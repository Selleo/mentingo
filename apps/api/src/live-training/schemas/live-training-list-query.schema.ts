import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import {
  liveTrainingDeliveryTypeSchema,
  liveTrainingStatusSchema,
} from "./live-training-common.schema";

export const liveTrainingListQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  perPage: Type.Optional(Type.Number({ minimum: 1 })),
  status: Type.Optional(liveTrainingStatusSchema),
  deliveryType: Type.Optional(liveTrainingDeliveryTypeSchema),
  start: Type.Optional(Type.String({ minLength: 1 })),
  end: Type.Optional(Type.String({ minLength: 1 })),
  courseId: Type.Optional(UUIDSchema),
  language: supportedLanguagesSchema,
});

export type LiveTrainingListQuery = Static<typeof liveTrainingListQuerySchema>;
