import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const bulkUserPasswordEmailSchema = Type.Object({
  userIds: Type.Array(UUIDSchema),
});

export const bulkUserPasswordEmailResponseSchema = Type.Object({
  sentCount: Type.Number(),
  skippedCount: Type.Number(),
});

export type BulkUserPasswordEmailBody = Static<typeof bulkUserPasswordEmailSchema>;
export type BulkUserPasswordEmailResponse = Static<typeof bulkUserPasswordEmailResponseSchema>;
