import { Type } from "@sinclair/typebox";

import { couponSchema } from "./coupon.schema";

import type { Static } from "@sinclair/typebox";

export const restrictionsSchema = Type.Object({
  firstTimeTransaction: Type.Boolean(),
  minimumAmount: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  minimumAmountCurrency: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export const promotionCodeSchema = Type.Object({
  id: Type.String(),
  active: Type.Boolean(),
  code: Type.String(),
  coupon: couponSchema,
  created: Type.Number(),
  customer: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  expiresAt: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  livemode: Type.Boolean(),
  maxRedemptions: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  metadata: Type.Object({}, { additionalProperties: true }),
  restrictions: restrictionsSchema,
  timesRedeemed: Type.Number(),
});

export type PromotionCode = Static<typeof promotionCodeSchema>;
