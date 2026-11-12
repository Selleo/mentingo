import { ArchiveUsersEvent, DeleteUserEvent } from "src/events";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { MicrosoftCalendarService } from "../services/microsoft-calendar.service";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

@OutboxEventsHandler(DeleteUserEvent, ArchiveUsersEvent)
export class MicrosoftCalendarUserLifecycleHandler
  implements OutboxEventsHandlerOf<DeleteUserEvent | ArchiveUsersEvent>
{
  constructor(private readonly microsoftCalendarService: MicrosoftCalendarService) {}

  async handleOutboxEvent(event: DeleteUserEvent | ArchiveUsersEvent) {
    if (event instanceof DeleteUserEvent) {
      await this.handleDeleteUserEvent(event);
    }

    if (event instanceof ArchiveUsersEvent) {
      await this.handleArchiveUsersEvent(event);
    }
  }

  async handleDeleteUserEvent(event: DeleteUserEvent) {
    await this.microsoftCalendarService.disconnectUsers([event.deleteUserData.userId]);
  }

  async handleArchiveUsersEvent(event: ArchiveUsersEvent) {
    await this.microsoftCalendarService.disconnectUsers(event.userIds);
  }
}
