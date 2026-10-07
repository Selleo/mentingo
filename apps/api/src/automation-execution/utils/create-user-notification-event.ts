import { randomUUID } from "node:crypto";

import { NotificationEvent } from "../events/notification-event";

import type { UserNotificationEventInput } from "../automation-execution.types";

export function createUserNotificationEvent({
  kind,
  user,
  language,
  eventFields,
  accountActionIntentId,
  occurrenceId = randomUUID(),
}: UserNotificationEventInput): NotificationEvent {
  return new NotificationEvent(occurrenceId, kind, [
    {
      itemId: user.id,
      email: user.email,
      name: user.firstName,
      language,
      eventFields: {
        ...eventFields,
        userFirstName: user.firstName,
        userLastName: user.lastName,
        userEmail: user.email,
      },
      ...(accountActionIntentId ? { accountActionIntentId } : {}),
    },
  ]);
}
