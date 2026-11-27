import { CALENDAR_CONNECTION_PUBLIC_STATUSES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { baseResponse } from "src/common";

export const googleCalendarConnectionSchema = Type.Object({
  available: Type.Boolean(),
  status: Type.Enum(CALENDAR_CONNECTION_PUBLIC_STATUSES),
  accountEmail: Type.Union([Type.String(), Type.Null()]),
  lastSuccessfulSyncAt: Type.Union([Type.String(), Type.Null()]),
  subscriptionExpiresAt: Type.Union([Type.String(), Type.Null()]),
  errorCode: Type.Union([Type.String(), Type.Null()]),
  stale: Type.Boolean(),
  outboundSyncEnabled: Type.Boolean(),
  outboundStatus: Type.String(),
  outboundCalendarId: Type.Union([Type.String(), Type.Null()]),
  outboundErrorCode: Type.Union([Type.String(), Type.Null()]),
  lastOutboundSyncAt: Type.Union([Type.String(), Type.Null()]),
});

export const googleCalendarConnectionResponseSchema = baseResponse(googleCalendarConnectionSchema);

export const googleCalendarOutboundUpdateSchema = Type.Object({ enabled: Type.Boolean() });

export const googleCalendarOutboundUpdateResultSchema = Type.Object({
  authorizationUrl: Type.Union([Type.String(), Type.Null()]),
});

export const googleCalendarOutboundUpdateResponseSchema = baseResponse(
  googleCalendarOutboundUpdateResultSchema,
);

export type GoogleCalendarConnectionResponse = Static<typeof googleCalendarConnectionSchema>;
export type GoogleCalendarOutboundUpdateBody = Static<typeof googleCalendarOutboundUpdateSchema>;
export type GoogleCalendarOutboundUpdateResult = Static<
  typeof googleCalendarOutboundUpdateResultSchema
>;
