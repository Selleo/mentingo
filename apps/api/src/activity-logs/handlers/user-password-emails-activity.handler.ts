import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { match } from "ts-pattern";

import {
  USER_PASSWORD_EMAIL_TYPES,
  UserPasswordEmailsEvent,
} from "src/events/user/user-password-emails.event";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";

@Injectable()
@EventsHandler(UserPasswordEmailsEvent)
export class UserPasswordEmailsActivityHandler implements IEventHandler<UserPasswordEmailsEvent> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: UserPasswordEmailsEvent) {
    const { actor, tenantId, type, recipients, sentCount, skippedCount } = event.userPasswordEmails;

    const operation = match(type)
      .with(
        USER_PASSWORD_EMAIL_TYPES.RESET,
        () => ACTIVITY_LOG_ACTION_TYPES.SEND_PASSWORD_RESET_EMAIL,
      )
      .with(
        USER_PASSWORD_EMAIL_TYPES.CREATION,
        () => ACTIVITY_LOG_ACTION_TYPES.RESEND_PASSWORD_CREATION_EMAIL,
      )
      .exhaustive();

    await this.activityLogsService.recordActivity({
      actor,
      tenantId,
      operation,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER,
      resourceId: null,
      context: {
        sentCount: String(sentCount),
        skippedCount: String(skippedCount),
        recipientUserIds: JSON.stringify(recipients.map(({ userId }) => userId)),
        recipientEmails: JSON.stringify(recipients.map(({ email }) => email)),
      },
    });
  }
}
