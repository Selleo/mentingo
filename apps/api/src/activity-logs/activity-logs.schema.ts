import { Type } from "@sinclair/typebox";
import { createSelectSchema } from "drizzle-typebox";

import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "src/activity-logs/types";
import { activityLogs } from "src/storage/schema";
import { omitTenantId } from "src/utils/omitTenantId";

export const activityLogActionTypeSchema = Type.Union(
  Object.values(ACTIVITY_LOG_ACTION_TYPES).map((actionType) => Type.Literal(actionType)),
);

export const activityLogResourceTypeSchema = Type.Union(
  Object.values(ACTIVITY_LOG_RESOURCE_TYPES).map((resourceType) => Type.Literal(resourceType)),
);

const baseActivityLogSchema = omitTenantId(
  createSelectSchema(activityLogs, {
    createdAt: Type.String(),
    updatedAt: Type.String(),
    actionType: activityLogActionTypeSchema,
    metadata: Type.Any(),
    resourceType: Type.Union([Type.String(), Type.Null()]),
    resourceId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  }),
);

export const activityLogsListSchema = Type.Array(baseActivityLogSchema);
