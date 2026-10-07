import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

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

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

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

@Injectable()
@EventsHandler(...emailTemplateActivityEvents)
export class EmailTemplateActivityHandler implements IEventHandler<EmailTemplateActivityEvent> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: EmailTemplateActivityEvent) {
    const operation = this.getAction(event);
    const {
      actor,
      resource,
      previous,
      changedFields: eventChangedFields,
      context: eventContext,
    } = event.data;
    let changedFields: string[] | undefined;
    let before: Record<string, string> | undefined;
    let after: Record<string, string> | undefined;
    let context: Record<string, string> | null = null;

    if (event instanceof CreateEmailTemplateEvent) {
      after = buildActivityLogMetadata({
        previous: {},
        updated: resource,
        schema: "create",
      }).after;
      context = eventContext ?? null;
    } else if (event instanceof DeleteEmailTemplateEvent) {
      context = { name: resource.name ?? "" };
    } else {
      const metadata = buildActivityLogMetadata({
        previous: previous ?? {},
        updated: resource,
      });
      changedFields = eventChangedFields ?? metadata.changedFields;
      before = metadata.before;
      after = metadata.after;
      context = { ...metadata.context, ...eventContext };
    }

    await this.activityLogsService.recordActivity({
      actor,
      operation,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.EMAIL_TEMPLATE,
      resourceId: resource.id,
      changedFields,
      before,
      after,
      context,
    });
  }

  private getAction(event: EmailTemplateActivityEvent) {
    if (event instanceof CreateEmailTemplateEvent) return ACTIVITY_LOG_ACTION_TYPES.CREATE;
    if (event instanceof UpdateEmailTemplateEvent) return ACTIVITY_LOG_ACTION_TYPES.UPDATE;
    if (event instanceof PublishEmailTemplateEvent)
      return ACTIVITY_LOG_ACTION_TYPES.PUBLISH_EMAIL_TEMPLATE;
    if (event instanceof ArchiveEmailTemplateEvent)
      return ACTIVITY_LOG_ACTION_TYPES.ARCHIVE_EMAIL_TEMPLATE;
    if (event instanceof RestoreEmailTemplateEvent)
      return ACTIVITY_LOG_ACTION_TYPES.RESTORE_EMAIL_TEMPLATE;
    if (event instanceof AddEmailTemplateLanguageEvent)
      return ACTIVITY_LOG_ACTION_TYPES.ADD_EMAIL_TEMPLATE_LANGUAGE;
    if (event instanceof RemoveEmailTemplateLanguageEvent)
      return ACTIVITY_LOG_ACTION_TYPES.REMOVE_EMAIL_TEMPLATE_LANGUAGE;
    if (event instanceof DeleteEmailTemplateEvent) return ACTIVITY_LOG_ACTION_TYPES.DELETE;
    throw new Error("Unsupported email template activity event");
  }
}
