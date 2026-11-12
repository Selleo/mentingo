import { Injectable } from "@nestjs/common";
import { match, P } from "ts-pattern";

import {
  AddEmailTemplateLanguageEvent,
  ArchiveEmailTemplateEvent,
  CreateEmailTemplateEvent,
  DeleteEmailTemplateEvent,
  PublishEmailTemplateEvent,
  RemoveEmailTemplateLanguageEvent,
  RestoreEmailTemplateEvent,
  UpdateEmailTemplateEvent,
} from "src/events";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

import type { RecordActivityLogParams } from "../activity-logs.types";
import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

const emailTemplateActivityEvents = [
  CreateEmailTemplateEvent,
  UpdateEmailTemplateEvent,
  PublishEmailTemplateEvent,
  ArchiveEmailTemplateEvent,
  RestoreEmailTemplateEvent,
  AddEmailTemplateLanguageEvent,
  RemoveEmailTemplateLanguageEvent,
  DeleteEmailTemplateEvent,
] as const;

type EmailTemplateActivityEvent = InstanceType<(typeof emailTemplateActivityEvents)[number]>;

type EmailTemplateActivityChanges = Pick<
  RecordActivityLogParams,
  "changedFields" | "before" | "after" | "context"
>;

@Injectable()
@OutboxEventsHandler(...emailTemplateActivityEvents)
export class EmailTemplateActivityHandler
  implements OutboxEventsHandlerOf<EmailTemplateActivityEvent>
{
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handleOutboxEvent(event: EmailTemplateActivityEvent) {
    const { actor, resource } = event.data;

    await this.activityLogsService.recordActivity({
      actor,
      operation: this.getOperation(event),
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.EMAIL_TEMPLATE,
      resourceId: resource.id,
      ...this.describeChanges(event),
    });
  }

  /** Creation keeps the new values, deletion only the name, every other action the difference. */
  private describeChanges(event: EmailTemplateActivityEvent): EmailTemplateActivityChanges {
    const { resource, previous, changedFields, context } = event.data;

    return match(event)
      .with(P.instanceOf(CreateEmailTemplateEvent), () => ({
        after: buildActivityLogMetadata({ previous: {}, updated: resource, schema: "create" })
          .after,
        context: context ?? null,
      }))
      .with(P.instanceOf(DeleteEmailTemplateEvent), () => ({
        context: { name: resource.name ?? "" },
      }))
      .otherwise(() => {
        const metadata = buildActivityLogMetadata({ previous: previous ?? {}, updated: resource });

        return {
          changedFields: changedFields ?? metadata.changedFields,
          before: metadata.before,
          after: metadata.after,
          context: { ...metadata.context, ...context },
        };
      });
  }

  private getOperation(event: EmailTemplateActivityEvent) {
    return match(event)
      .with(P.instanceOf(CreateEmailTemplateEvent), () => ACTIVITY_LOG_ACTION_TYPES.CREATE)
      .with(P.instanceOf(UpdateEmailTemplateEvent), () => ACTIVITY_LOG_ACTION_TYPES.UPDATE)
      .with(
        P.instanceOf(PublishEmailTemplateEvent),
        () => ACTIVITY_LOG_ACTION_TYPES.PUBLISH_EMAIL_TEMPLATE,
      )
      .with(
        P.instanceOf(ArchiveEmailTemplateEvent),
        () => ACTIVITY_LOG_ACTION_TYPES.ARCHIVE_EMAIL_TEMPLATE,
      )
      .with(
        P.instanceOf(RestoreEmailTemplateEvent),
        () => ACTIVITY_LOG_ACTION_TYPES.RESTORE_EMAIL_TEMPLATE,
      )
      .with(
        P.instanceOf(AddEmailTemplateLanguageEvent),
        () => ACTIVITY_LOG_ACTION_TYPES.ADD_EMAIL_TEMPLATE_LANGUAGE,
      )
      .with(
        P.instanceOf(RemoveEmailTemplateLanguageEvent),
        () => ACTIVITY_LOG_ACTION_TYPES.REMOVE_EMAIL_TEMPLATE_LANGUAGE,
      )
      .with(P.instanceOf(DeleteEmailTemplateEvent), () => ACTIVITY_LOG_ACTION_TYPES.DELETE)
      .exhaustive();
  }
}
