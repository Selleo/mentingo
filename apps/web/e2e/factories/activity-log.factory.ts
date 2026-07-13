import type { FixtureApiClient } from "../utils/api-client";
import type { GetActivityLogsResponse } from "~/api/generated-api";

export type ActivityLogFactoryRecord = GetActivityLogsResponse["data"][number];
export type ActivityLogResourceType = NonNullable<
  Parameters<FixtureApiClient["api"]["activityLogsControllerGetActivityLogs"]>[0]
>["resourceType"];
export type ActivityLogActionType = NonNullable<
  Parameters<FixtureApiClient["api"]["activityLogsControllerGetActivityLogs"]>[0]
>["actionTypes"];

export type ActivityLogQuery = {
  page?: number;
  perPage?: number;
  keyword?: string;
  email?: string;
  resourceType?: ActivityLogResourceType;
  from?: string;
  to?: string;
  actionTypes?: ActivityLogActionType;
};

export class ActivityLogFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async getLogs(query: ActivityLogQuery = {}): Promise<ActivityLogFactoryRecord[]> {
    const response = await this.apiClient.api.activityLogsControllerGetActivityLogs(query);

    return response.data.data;
  }

  async findByResourceId(
    resourceId: string,
    query: ActivityLogQuery = {},
  ): Promise<ActivityLogFactoryRecord[]> {
    const logs = await this.getLogs({ ...query, perPage: 100 });

    return logs.filter((log) => log.resourceId === resourceId);
  }
}
