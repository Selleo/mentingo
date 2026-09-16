import { LIVE_TRAINING_REGISTRATION_STATUSES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema, baseResponse } from "src/common";

export const registrationStatusSchema = Type.Enum(LIVE_TRAINING_REGISTRATION_STATUSES);
export const registrationSummarySchema = Type.Object({
  registeredCount: Type.Integer(),
  waitlistedCount: Type.Integer(),
  status: Type.Union([registrationStatusSchema, Type.Null()]),
  position: Type.Union([Type.Integer(), Type.Null()]),
  isOpen: Type.Boolean(),
});
export const registrationParticipantSchema = Type.Object({
  userId: UUIDSchema,
  fullName: Type.String(),
  status: registrationStatusSchema,
  joinedAt: Type.String(),
});
export const registrationListSchema = Type.Array(registrationParticipantSchema);
export const registrationListResponseSchema = baseResponse(registrationListSchema);
export const registrationSummaryResponseSchema = baseResponse(registrationSummarySchema);
export type RegistrationSummary = Static<typeof registrationSummarySchema>;
export type RegistrationParticipant = Static<typeof registrationParticipantSchema>;
