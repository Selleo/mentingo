import { Injectable } from "@nestjs/common";
import { ACTIVITY_LOG_RESOURCE_TYPES } from "@repo/shared";
import { match, P } from "ts-pattern";

import { AutomationActivityEvent } from "src/events/automation/automation-activity.event";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { ActivityLogsService } from "../activity-logs.service";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

import type { ActivityLogMetadata } from "../types";
import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

@Injectable()
@OutboxEventsHandler(AutomationActivityEvent)
export class AutomationActivityHandler implements OutboxEventsHandlerOf<AutomationActivityEvent> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handleOutboxEvent({ data }: AutomationActivityEvent) {
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
