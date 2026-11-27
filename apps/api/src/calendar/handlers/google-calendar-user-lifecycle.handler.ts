import { match } from "ts-pattern";

import { ArchiveUsersEvent, DeleteUserEvent } from "src/events";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { GoogleCalendarService } from "../services/google-calendar.service";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

@OutboxEventsHandler(DeleteUserEvent, ArchiveUsersEvent)
export class GoogleCalendarUserLifecycleHandler
  implements OutboxEventsHandlerOf<DeleteUserEvent | ArchiveUsersEvent>
{
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  async handleOutboxEvent(event: DeleteUserEvent | ArchiveUsersEvent) {
    const userIds = match(event)
      .when(
        (userEvent): userEvent is DeleteUserEvent => userEvent instanceof DeleteUserEvent,
        (deleteUserEvent) => [deleteUserEvent.deleteUserData.userId],
      )
      .otherwise((archiveUsersEvent) => archiveUsersEvent.userIds);

    await this.googleCalendarService.disconnectUsers(userIds);
  }
}
