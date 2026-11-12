import type { activityLogsListSchema } from "./activity-logs.schema";
import type { ActivityLogActionType, ActivityLogResourceType } from "./types";
import type { Static } from "@sinclair/typebox/build/cjs/type/static/static";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type ActivityLogResponse = Static<typeof activityLogsListSchema>[number];
export type ActivityLogsListResponse = Static<typeof activityLogsListSchema>;

export type RecordActivityLogInput = {
  actor: ActorType;
  operation: ActivityLogActionType;
  resourceType?: ActivityLogResourceType | null;
  resourceId?: UUIDType | null;
  changedFields?: string[];
  before?: Record<string, string> | null;
  after?: Record<string, string> | null;
  context?: Record<string, string> | null;
  tenantId?: UUIDType;
  /** When the action happened, if the activity is recorded later; defaults to the insert time. */
  occurredAt?: string;
};

export type ActorType = {
  actorId: UUIDType;
  actorEmail: string;
  actorRole: string;
};

export type GetActivityLogsQuery = {
  keyword?: string;
  email?: string;
  actionTypes?: ActivityLogActionType[];
  resourceType?: ActivityLogResourceType;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
};

export type RecordActivityLogParams = Omit<RecordActivityLogInput, "actor"> & {
  actor: ActorUserType;
};
