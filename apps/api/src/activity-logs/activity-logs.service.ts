import { Inject, Injectable } from "@nestjs/common";
import { endOfDay, startOfDay } from "date-fns";
import { count, desc, getTableColumns, and, like, gte, lte } from "drizzle-orm";

import { DatabasePg, type Pagination } from "src/common";
import { addPagination, DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { dbAls } from "src/storage/db/db-als.store";
import { activityLogs } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { ActivityLogsQueueService } from "./activity-logs.queue.service";

import type {
  ActorType,
  ActivityLogsListResponse,
  GetActivityLogsQuery,
  RecordActivityLogInput,
  RecordActivityLogParams,
} from "./activity-logs.types";
import type { ActivityLogMetadata } from "./types";
import type { SQL } from "drizzle-orm";
import type { ActorUserType } from "src/common/types/actor-user.type";

@Injectable()
export class ActivityLogsService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly activityLogsQueueService: ActivityLogsQueueService,
  ) {}

  async recordActivity(payload: RecordActivityLogParams): Promise<void> {
    const tenantId = dbAls.getStore()?.tenantId;

    if (process.env.NODE_ENV === "test") {
      return this.persistActivityLog({
        ...(tenantId ? { tenantId } : {}),
        ...payload,
        actor: this.getActorFromPayload(payload.actor),
      });
    }

    await this.activityLogsQueueService.enqueueActivityLog({
      ...(tenantId ? { tenantId } : {}),
      ...payload,
      actor: this.getActorFromPayload(payload.actor),
    });
  }

  async persistActivityLog(payload: RecordActivityLogInput): Promise<void> {
    const metadata: ActivityLogMetadata = {
      operation: payload.operation,
      changedFields: payload.changedFields,
      before: payload.before ?? null,
      after: payload.after ?? null,
      context: payload.context ?? null,
    };

    await this.db.insert(activityLogs).values({
      ...payload.actor,
      actionType: payload.operation,
      resourceType: payload.resourceType ?? null,
      resourceId: payload.resourceId ?? null,
      metadata: settingsToJSONBuildObject(metadata),
    });
  }

  async getActivityLogs({
    keyword,
    email,
    from,
    to,
    page = 1,
    perPage = DEFAULT_PAGE_SIZE,
  }: GetActivityLogsQuery): Promise<{
    data: ActivityLogsListResponse;
    pagination: Pagination;
  }> {
    const conditions: SQL[] = [];

    if (email) {
      const pattern = `%${email.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
      conditions.push(like(activityLogs.actorEmail, pattern));
    }

    if (from)
      conditions.push(gte(activityLogs.createdAt, startOfDay(new Date(from)).toISOString()));

    if (to) conditions.push(lte(activityLogs.createdAt, endOfDay(new Date(to)).toISOString()));

    if (keyword) {
      const pattern = `%${keyword.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
      conditions.push(like(activityLogs.actorEmail, pattern));
    }

    const query = this.db
      .select({
        ...getTableColumns(activityLogs),
      })
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .where(and(...conditions));

    const logSearchQuery = addPagination(query.$dynamic(), page, perPage);

    const countQuery = this.db
      .select({ totalItems: count() })
      .from(activityLogs)
      .where(and(...conditions));

    const [data, [{ totalItems }]] = await Promise.all([logSearchQuery, countQuery]);

    return {
      data,
      pagination: { totalItems, page, perPage },
    };
  }

  private getActorFromPayload(actor: ActorUserType): ActorType {
    const roleSlugs = actor.roleSlugs.join(", ");

    return {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: roleSlugs,
    };
  }
}
