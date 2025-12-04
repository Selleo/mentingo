import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { activityLogs, users } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import type { ActivityLogActionType, ActivityLogMetadata, ActivityLogResourceType } from "./types";

export type RecordActivityLogInput = {
  actorId: UUIDType;
  operation: ActivityLogActionType;
  resourceType?: ActivityLogResourceType | null;
  resourceId?: UUIDType | null;
  changedFields?: string[];
  before?: Record<string, string> | null;
  after?: Record<string, string> | null;
  context?: Record<string, string> | null;
};

@Injectable()
export class ActivityLogsService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async recordActivity(payload: RecordActivityLogInput): Promise<void> {
    const metadata: ActivityLogMetadata = {
      operation: payload.operation,
      changedFields: payload.changedFields,
      before: payload.before ?? null,
      after: payload.after ?? null,
      context: payload.context ?? null,
    };

    const [{ actorEmail, actorRole }] = await this.db
      .select({
        actorEmail: users.email,
        actorRole: users.role,
      })
      .from(users)
      .where(eq(users.id, payload.actorId));

    await this.db.insert(activityLogs).values({
      actorId: payload.actorId,
      actorEmail,
      actorRole,
      actionType: payload.operation,
      resourceType: payload.resourceType ?? null,
      resourceId: payload.resourceId ?? null,
      metadata: settingsToJSONBuildObject(metadata),
    });
  }
}
