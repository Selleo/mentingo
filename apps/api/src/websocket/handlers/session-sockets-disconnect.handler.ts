import { Injectable } from "@nestjs/common";
import { EventsHandler } from "@nestjs/cqrs";

import { UserSessionRevokedEvent } from "src/events/user/user-session-revoked.event";
import { WsGateway } from "src/websocket/websocket.gateway";

import type { IEventHandler } from "@nestjs/cqrs";

/** Closes sockets opened with a revoked session, so they stop receiving server pushes. */
@Injectable()
@EventsHandler(UserSessionRevokedEvent)
export class SessionSocketsDisconnectHandler implements IEventHandler<UserSessionRevokedEvent> {
  constructor(private readonly wsGateway: WsGateway) {}

  handle(event: UserSessionRevokedEvent) {
    this.wsGateway.disconnectSession(event.sessionData.sessionId);
  }
}
