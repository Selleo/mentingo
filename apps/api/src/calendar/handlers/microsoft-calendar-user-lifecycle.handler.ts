import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { ArchiveUsersEvent, DeleteUserEvent } from "src/events";

import { MicrosoftCalendarService } from "../services/microsoft-calendar.service";

@EventsHandler(DeleteUserEvent, ArchiveUsersEvent)
export class MicrosoftCalendarUserLifecycleHandler
  implements IEventHandler<DeleteUserEvent | ArchiveUsersEvent>
{
  constructor(private readonly microsoftCalendarService: MicrosoftCalendarService) {}

  async handle(event: DeleteUserEvent | ArchiveUsersEvent) {
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
