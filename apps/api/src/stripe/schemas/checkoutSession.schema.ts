import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const checkoutSessionSchema = Type.Object({
  amountInCents: Type.Number(),
  currency: Type.Optional(Type.String()),
  allowPromotionCode: Type.Optional(Type.Boolean()),
  quantity: Type.Optional(Type.Number()),
  productName: Type.String(),
  productDescription: Type.Optional(Type.String()),
  courseId: Type.String(),
  customerId: Type.String(),
  locale: Type.Optional(Type.String()),
});

export type CreateCheckoutSessionBody = Static<typeof checkoutSessionSchema>;
