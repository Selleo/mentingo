import { Type, type Static } from "@sinclair/typebox";

import { paginatedResponse } from "src/common";

import { liveTrainingHostCandidateSchema } from "./live-training-common.schema";

export const liveTrainingHostCandidatesQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  perPage: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  keyword: Type.Optional(Type.String()),
});

export const liveTrainingHostCandidatesResponseSchema = paginatedResponse(
  Type.Array(liveTrainingHostCandidateSchema),
);

export type LiveTrainingHostCandidatesQuery = Static<typeof liveTrainingHostCandidatesQuerySchema>;
export type LiveTrainingHostCandidatesResponse = Static<
  typeof liveTrainingHostCandidatesResponseSchema
>;
