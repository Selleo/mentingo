import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const updatePromotionCodeSchema = Type.Object({
  active: Type.Optional(Type.Boolean()),
  assignedCourseIds: Type.Optional(Type.Array(Type.String())),
});

export type UpdatePromotionCode = Static<typeof updatePromotionCodeSchema>;
