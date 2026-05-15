import { Type, type Static } from "@sinclair/typebox";

import { paginatedResponse } from "src/common";

import { liveTrainingBaseSchema } from "./live-training-common.schema";

export const liveTrainingListItemSchema = liveTrainingBaseSchema;

export const liveTrainingListResponseSchema = paginatedResponse(
  Type.Array(liveTrainingListItemSchema),
);

export type LiveTrainingListItem = Static<typeof liveTrainingListItemSchema>;
export type LiveTrainingListResponse = Static<typeof liveTrainingListResponseSchema>;
