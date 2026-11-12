import { Injectable } from "@nestjs/common";

import { UserSessionRevokedEvent } from "src/events/user/user-session-revoked.event";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { WsGateway } from "src/websocket/websocket.gateway";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

/** Closes sockets opened with a revoked session, so they stop receiving server pushes. */
@Injectable()
@OutboxEventsHandler(UserSessionRevokedEvent)
export class SessionSocketsDisconnectHandler
  implements OutboxEventsHandlerOf<UserSessionRevokedEvent>
{
  constructor(private readonly wsGateway: WsGateway) {}

  async handleOutboxEvent(event: UserSessionRevokedEvent) {
    this.wsGateway.disconnectSession(event.sessionData.sessionId);
  }
}
