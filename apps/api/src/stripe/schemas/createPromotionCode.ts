import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const createPromotionCodeSchema = Type.Object({
  code: Type.String(),
  amountOff: Type.Optional(Type.Integer()),
  percentOff: Type.Optional(Type.Integer()),
  maxRedemptions: Type.Optional(Type.Integer()),
  assignedStripeCourseIds: Type.Optional(Type.Array(Type.String())),
  currency: Type.Optional(Type.String()),
  expiresAt: Type.Optional(Type.String()),
  courseId: Type.Optional(Type.Array(Type.String({ format: "uuid" }))),
});

export type CreatePromotionCode = Static<typeof createPromotionCodeSchema>;
