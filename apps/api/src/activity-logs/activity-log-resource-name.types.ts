import type { ActivityLogResponse } from "./activity-logs.types";

export type ActivityLogResourceReference = Pick<ActivityLogResponse, "resourceId" | "resourceType">;

export type NamedActivityLogResource = {
  id: string;
  name: string;
};
