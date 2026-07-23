import { MICROSOFT_CALENDAR_PUBLIC_STATUSES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { baseResponse } from "src/common";

export const microsoftCalendarConnectionSchema = Type.Object({
  available: Type.Boolean(),
  status: Type.Enum(MICROSOFT_CALENDAR_PUBLIC_STATUSES),
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

export const microsoftCalendarConnectionResponseSchema = baseResponse(
  microsoftCalendarConnectionSchema,
);

export const microsoftCalendarOutboundUpdateSchema = Type.Object({ enabled: Type.Boolean() });
export const microsoftCalendarOutboundUpdateResponseSchema = baseResponse(
  Type.Object({ authorizationUrl: Type.Union([Type.String(), Type.Null()]) }),
);

export const microsoftGraphNotificationBodySchema = Type.Object(
  {
    value: Type.Optional(
      Type.Array(
        Type.Object(
          {
            subscriptionId: Type.Optional(Type.String()),
            clientState: Type.Optional(Type.String()),
            lifecycleEvent: Type.Optional(Type.String()),
          },
          { additionalProperties: true },
        ),
      ),
    ),
  },
  { additionalProperties: true },
);

export const microsoftGraphValidationTokenSchema = Type.Optional(Type.String());
