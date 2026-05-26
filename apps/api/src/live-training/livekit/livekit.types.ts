import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { LiveTrainingSettings } from "@repo/shared";
import type { Room, TrackSource, WebhookEvent } from "livekit-server-sdk";

export const liveKitConfigSchema = Type.Object({
  url: Type.String(),
  apiKey: Type.String(),
  apiSecret: Type.String(),
});

export type LiveKitConfig = Static<typeof liveKitConfigSchema>;

export const liveKitRoomMetadataSchema = Type.Object({
  tenantId: UUIDSchema,
  liveTrainingId: UUIDSchema,
  sessionId: UUIDSchema,
});

export type LiveKitRoomMetadata = Static<typeof liveKitRoomMetadataSchema>;

export const createLiveKitRoomInputSchema = Type.Object({
  roomName: Type.String(),
  maxParticipants: Type.Integer({ minimum: 1 }),
  metadata: liveKitRoomMetadataSchema,
  emptyTimeoutSeconds: Type.Optional(Type.Integer({ minimum: 1 })),
  departureTimeoutSeconds: Type.Optional(Type.Integer({ minimum: 1 })),
});

export type CreateLiveKitRoomInput = Static<typeof createLiveKitRoomInputSchema>;

export const liveKitRoomSummarySchema = Type.Object({
  sid: Type.String(),
  name: Type.String(),
  metadata: Type.Union([liveKitRoomMetadataSchema, Type.Null()]),
  participantCount: Type.Number(),
  publisherCount: Type.Number(),
  maxParticipants: Type.Number(),
  activeRecording: Type.Boolean(),
  createdAtMs: Type.Number(),
});

export type LiveKitRoomSummary = Static<typeof liveKitRoomSummarySchema>;

export const getLiveKitRoomStateInputSchema = Type.Object({
  roomName: Type.String(),
});

export type GetLiveKitRoomStateInput = Static<typeof getLiveKitRoomStateInputSchema>;

export const liveKitRoomStateSchema = Type.Object({
  exists: Type.Boolean(),
  room: Type.Union([liveKitRoomSummarySchema, Type.Null()]),
  participantCount: Type.Number(),
});

export type LiveKitRoomState = Static<typeof liveKitRoomStateSchema>;

export const createLiveKitParticipantTokenInputSchema = Type.Object({
  roomName: Type.String(),
  identity: Type.String(),
  displayName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  ttlSeconds: Type.Optional(Type.Integer({ minimum: 1 })),
  canPublishAudio: Type.Boolean(),
  canPublishVideo: Type.Boolean(),
  canPublishScreenShare: Type.Boolean(),
  canPublishData: Type.Optional(Type.Boolean()),
  canUpdateOwnMetadata: Type.Optional(Type.Boolean()),
});

export type CreateLiveKitParticipantTokenInput = Static<
  typeof createLiveKitParticipantTokenInputSchema
>;

export const createLiveKitParticipantTokenResultSchema = Type.Object({
  token: Type.String(),
  url: Type.String(),
  identity: Type.String(),
});

export type CreateLiveKitParticipantTokenResult = Static<
  typeof createLiveKitParticipantTokenResultSchema
>;

export const createLiveKitRoomResultSchema = Type.Object({
  roomName: Type.String(),
  room: liveKitRoomSummarySchema,
});

export type CreateLiveKitRoomResult = Static<typeof createLiveKitRoomResultSchema> & {
  rawRoom: Room;
};

export type LiveKitViewerPermissions = LiveTrainingSettings["viewerPermissions"];

export type LiveKitWebhookResult = WebhookEvent;

export type LiveKitPublishSource = TrackSource;
