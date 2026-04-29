import { Type } from "@sinclair/typebox";
import { createSelectSchema } from "drizzle-typebox";

import { activityLogs } from "src/storage/schema";
import { omitTenantId } from "src/utils/omitTenantId";

const baseActivityLogSchema = omitTenantId(
  createSelectSchema(activityLogs, {
    createdAt: Type.String(),
    updatedAt: Type.String(),
    metadata: Type.Any(),
    resourceType: Type.Union([Type.String(), Type.Null()]),
    resourceId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  }),
);

export const activityLogsListSchema = Type.Array(baseActivityLogSchema);
