import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const userNotificationsCreatedDataSchema = Type.Object({
  userIds: Type.Array(UUIDSchema),
});

export const userNotificationsCreatedEventSchema = Type.Object({
  userNotificationsCreatedData: userNotificationsCreatedDataSchema,
});
