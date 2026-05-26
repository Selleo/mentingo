import {
  LIVE_TRAINING_PARTICIPANT_ROLES,
  LIVE_TRAINING_SESSION_STATUSES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

const nullableStringSchema = Type.Union([Type.String(), Type.Null()]);
const nullableUuidSchema = Type.Union([UUIDSchema, Type.Null()]);

export const liveTrainingSessionRowSchema = Type.Object({
  id: UUIDSchema,
  status: Type.Enum(LIVE_TRAINING_SESSION_STATUSES),
  startedAt: nullableStringSchema,
  endedAt: nullableStringSchema,
  startedByUserId: nullableUuidSchema,
  endedByUserId: nullableUuidSchema,
  startedByFullName: nullableStringSchema,
  startedByAvatarReference: nullableStringSchema,
  endedByFullName: nullableStringSchema,
  endedByAvatarReference: nullableStringSchema,
  peakParticipantCount: Type.Number(),
  uniqueParticipantCount: Type.Number(),
  activeParticipantCount: Type.Number(),
  endReason: nullableStringSchema,
});

export const liveTrainingSessionParticipantRowSchema = Type.Object({
  id: UUIDSchema,
  userId: UUIDSchema,
  fullName: nullableStringSchema,
  avatarReference: nullableStringSchema,
  role: Type.Enum(LIVE_TRAINING_PARTICIPANT_ROLES),
  firstJoinedAt: nullableStringSchema,
  lastLeftAt: nullableStringSchema,
  totalSeconds: Type.Number(),
  joinCount: Type.Number(),
});

export const liveTrainingAttendanceRowSchema = Type.Object({
  id: UUIDSchema,
  participantId: UUIDSchema,
  joinedAt: Type.String(),
  leftAt: nullableStringSchema,
  disconnectReason: nullableStringSchema,
});

export const liveTrainingSessionTenantRowSchema = Type.Object({
  id: UUIDSchema,
  liveTrainingId: UUIDSchema,
  tenantId: UUIDSchema,
});

export const liveTrainingSessionRoomRowSchema = Type.Object({
  id: UUIDSchema,
  liveTrainingId: UUIDSchema,
  status: Type.Enum(LIVE_TRAINING_SESSION_STATUSES),
  livekitRoomName: nullableStringSchema,
});

export const liveTrainingCreatedSessionRowSchema = Type.Object({
  id: UUIDSchema,
});

export const liveTrainingUserDisplayRowSchema = Type.Object({
  id: UUIDSchema,
  fullName: nullableStringSchema,
  avatarReference: nullableStringSchema,
});

export const liveTrainingLessonCompletionRowSchema = Type.Object({
  lessonId: UUIDSchema,
  studentId: UUIDSchema,
  language: Type.Enum(SUPPORTED_LANGUAGES),
});

export type LiveTrainingSessionRow = Static<typeof liveTrainingSessionRowSchema>;
export type LiveTrainingSessionParticipantRow = Static<
  typeof liveTrainingSessionParticipantRowSchema
>;
export type LiveTrainingAttendanceRow = Static<typeof liveTrainingAttendanceRowSchema>;
export type LiveTrainingSessionTenantRow = Static<typeof liveTrainingSessionTenantRowSchema>;
export type LiveTrainingSessionRoomRow = Static<typeof liveTrainingSessionRoomRowSchema>;
export type LiveTrainingLessonCompletionRow = Static<typeof liveTrainingLessonCompletionRowSchema>;
export type LiveTrainingCreatedSessionRow = Static<typeof liveTrainingCreatedSessionRowSchema>;
export type LiveTrainingUserDisplayRow = Static<typeof liveTrainingUserDisplayRowSchema>;
