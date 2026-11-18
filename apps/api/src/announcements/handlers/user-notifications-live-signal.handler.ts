import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_SOCKET_EVENTS } from "@repo/shared";

import { UserNotificationsCreatedEvent } from "src/events/announcement/user-notifications-created.event";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { REALTIME_PUBLISHER, type RealtimePublisher } from "src/websocket/realtime.publisher";
import { getUserRoomName } from "src/websocket/websocket.rooms";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

@Injectable()
@OutboxEventsHandler(UserNotificationsCreatedEvent)
export class UserNotificationsLiveSignalHandler
  implements OutboxEventsHandlerOf<UserNotificationsCreatedEvent>
{
  constructor(@Inject(REALTIME_PUBLISHER) private readonly realtimePublisher: RealtimePublisher) {}

  async handleOutboxEvent(event: UserNotificationsCreatedEvent) {
    for (const userId of event.userNotificationsCreatedData.userIds) {
      this.realtimePublisher.emitToRoom(
        NOTIFICATION_SOCKET_EVENTS.CREATED,
        getUserRoomName(userId),
        {},
      );
    }
  }
}
