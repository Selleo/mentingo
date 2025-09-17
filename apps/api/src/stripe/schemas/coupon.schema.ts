import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const couponSchema = Type.Object({
  id: Type.String(),
  amountOff: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  percentOff: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  created: Type.Number(),
  currency: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  duration: Type.String(),
  durationInMonths: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  livemode: Type.Boolean(),
  maxRedemptions: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  metadata: Type.Object({}, { additionalProperties: true }),
  name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  redeemBy: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  timesRedeemed: Type.Number(),
  valid: Type.Boolean(),
});

export type Coupon = Static<typeof couponSchema>;
