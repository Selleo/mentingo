import { LIVE_TRAINING_PARTICIPANT_ROLES, LIVE_TRAINING_SESSION_STATUSES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema, baseResponse } from "src/common";

export const handleLiveKitWebhookInputSchema = Type.Object({
  body: Type.String(),
  authorizationHeader: Type.Optional(Type.String()),
});

export const liveTrainingSessionUserSchema = Type.Object({
  id: UUIDSchema,
  fullName: Type.Union([Type.String(), Type.Null()]),
  profilePictureUrl: Type.Union([Type.String(), Type.Null()]),
});

export const liveTrainingSessionSummarySchema = Type.Object({
  id: UUIDSchema,
  status: Type.Enum(LIVE_TRAINING_SESSION_STATUSES),
  startedAt: Type.Union([Type.String(), Type.Null()]),
  endedAt: Type.Union([Type.String(), Type.Null()]),
  startedByUserId: Type.Union([UUIDSchema, Type.Null()]),
  endedByUserId: Type.Union([UUIDSchema, Type.Null()]),
  startedBy: Type.Union([liveTrainingSessionUserSchema, Type.Null()]),
  endedBy: Type.Union([liveTrainingSessionUserSchema, Type.Null()]),
  activeParticipantCount: Type.Number(),
  uniqueParticipantCount: Type.Number(),
  peakParticipantCount: Type.Number(),
  endReason: Type.Union([Type.String(), Type.Null()]),
});

export const liveTrainingAttendanceIntervalSchema = Type.Object({
  id: UUIDSchema,
  joinedAt: Type.String(),
  leftAt: Type.Union([Type.String(), Type.Null()]),
  disconnectReason: Type.Union([Type.String(), Type.Null()]),
});

export const liveTrainingSessionParticipantSchema = Type.Object({
  id: UUIDSchema,
  user: liveTrainingSessionUserSchema,
  role: Type.Enum(LIVE_TRAINING_PARTICIPANT_ROLES),
  firstJoinedAt: Type.Union([Type.String(), Type.Null()]),
  lastLeftAt: Type.Union([Type.String(), Type.Null()]),
  totalSeconds: Type.Number(),
  joinCount: Type.Number(),
  intervals: Type.Array(liveTrainingAttendanceIntervalSchema),
});

export const liveTrainingSessionDetailsSchema = Type.Intersect([
  liveTrainingSessionSummarySchema,
  Type.Object({
    participants: Type.Array(liveTrainingSessionParticipantSchema),
  }),
]);

export const liveTrainingSessionListResponseSchema = baseResponse(
  Type.Array(liveTrainingSessionSummarySchema),
);

export const liveTrainingSessionSummaryResponseSchema = baseResponse(
  liveTrainingSessionSummarySchema,
);

export const liveTrainingSessionDetailsResponseSchema = baseResponse(
  liveTrainingSessionDetailsSchema,
);

export const joinLiveTrainingSessionResponseSchema = Type.Object({
  sessionId: UUIDSchema,
  livekitUrl: Type.String(),
  token: Type.String(),
  identity: Type.String(),
  role: Type.Enum(LIVE_TRAINING_PARTICIPANT_ROLES),
  viewerPermissions: Type.Object({
    microphoneEnabled: Type.Boolean(),
    cameraEnabled: Type.Boolean(),
  }),
});

export const joinLiveTrainingSessionBaseResponseSchema = baseResponse(
  joinLiveTrainingSessionResponseSchema,
);

export type HandleLiveKitWebhookInput = Static<typeof handleLiveKitWebhookInputSchema>;
export type LiveTrainingSessionUser = Static<typeof liveTrainingSessionUserSchema>;
export type LiveTrainingSessionSummary = Static<typeof liveTrainingSessionSummarySchema>;
export type LiveTrainingAttendanceInterval = Static<typeof liveTrainingAttendanceIntervalSchema>;
export type LiveTrainingSessionParticipant = Static<typeof liveTrainingSessionParticipantSchema>;
export type LiveTrainingSessionDetails = Static<typeof liveTrainingSessionDetailsSchema>;
export type JoinLiveTrainingSessionResponse = Static<typeof joinLiveTrainingSessionResponseSchema>;
