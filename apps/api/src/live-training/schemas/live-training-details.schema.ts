import { Type, type Static } from "@sinclair/typebox";

import { baseResponse } from "src/common";

import { liveTrainingSessionSummarySchema } from "../live-training-sessions/live-training-sessions.types";

import {
  liveTrainingBaseSchema,
  liveTrainingCourseSummarySchema,
  liveTrainingMaterialSchema,
  liveTrainingSettingsSchema,
  liveTrainingUserSummarySchema,
} from "./live-training-common.schema";

export const liveTrainingDetailsSchema = Type.Intersect([
  liveTrainingBaseSchema,
  Type.Object({
    settings: liveTrainingSettingsSchema,
    metadata: Type.Record(Type.String(), Type.Unknown()),
    author: liveTrainingUserSummarySchema,
    hosts: Type.Array(liveTrainingUserSummarySchema),
    linkedCourses: Type.Array(liveTrainingCourseSummarySchema),
    linkedLessonCount: Type.Number(),
    currentSession: Type.Union([liveTrainingSessionSummarySchema, Type.Null()]),
    materials: Type.Object({
      before: Type.Array(liveTrainingMaterialSchema),
      after: Type.Array(liveTrainingMaterialSchema),
    }),
  }),
]);

export const liveTrainingDetailsResponseSchema = baseResponse(liveTrainingDetailsSchema);

export type LiveTrainingDetails = Static<typeof liveTrainingDetailsSchema>;
export type LiveTrainingDetailsResponse = Static<typeof liveTrainingDetailsResponseSchema>;
