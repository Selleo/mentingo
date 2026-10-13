import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { ACTIVITY_LOG_RESOURCE_TYPES } from "@repo/shared";
import { match, P } from "ts-pattern";

import { AutomationActivityEvent } from "src/events/automation/automation-activity.event";

import { ActivityLogsService } from "../activity-logs.service";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

import type { ActivityLogMetadata } from "../types";

@Injectable()
@EventsHandler(AutomationActivityEvent)
export class AutomationActivityHandler implements IEventHandler<AutomationActivityEvent> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle({ data }: AutomationActivityEvent) {
    const { actor, operation, resourceId, previous, resource } = data;
    const context = { name: resource?.name ?? previous?.name ?? "", ...data.context };

    const { before, after, changedFields } = match({ previous, resource })
      .returnType<Pick<ActivityLogMetadata, "before" | "after" | "changedFields">>()
      .with({ previous: P.nonNullable, resource: P.nonNullable }, ({ previous, resource }) =>
        buildActivityLogMetadata({ previous, updated: resource }),
      )
      .with({ resource: P.nonNullable }, ({ resource }) => ({
        before: null,
        after: buildActivityLogMetadata({ previous: null, updated: resource, schema: "create" })
          .after,
      }))
      .with({ previous: P.nonNullable }, ({ previous }) => ({
        before: buildActivityLogMetadata({ previous: null, updated: previous, schema: "create" })
          .after,
        after: null,
      }))
      .otherwise(() => ({ before: null, after: null }));

    await this.activityLogsService.recordActivity({
      actor,
      operation,
      resourceId,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.AUTOMATION,
      before,
      after,
      changedFields,
      context,
    });
  }
}
