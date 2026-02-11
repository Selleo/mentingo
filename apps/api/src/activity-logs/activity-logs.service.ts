import { Inject, Injectable } from "@nestjs/common";

import { DatabasePg, type UUIDType } from "src/common";
import { dbAls } from "src/storage/db/db-als.store";
import { activityLogs } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { ActivityLogsQueueService } from "./activity-logs.queue.service";

import type { ActivityLogActionType, ActivityLogMetadata, ActivityLogResourceType } from "./types";
import type { ActorUserType } from "src/common/types/actor-user.type";
import type { UserRole } from "src/user/schemas/userRoles";

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
};

export type ActorType = {
  actorId: UUIDType;
  actorEmail: string;
  actorRole: UserRole;
};

type RecordActivityLogParams = Omit<RecordActivityLogInput, "actor"> & {
  actor: ActorUserType;
};

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

  private getActorFromPayload(actor: ActorUserType): ActorType {
    return {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
    };
  }
}
