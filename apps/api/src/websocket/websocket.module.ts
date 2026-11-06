import { Global, Module } from "@nestjs/common";

import { WsJwtGuard } from "src/websocket/guards/ws-jwt.guard";
import { SessionSocketsDisconnectHandler } from "src/websocket/handlers/session-sockets-disconnect.handler";
import { REALTIME_PUBLISHER } from "src/websocket/realtime.publisher";
import { SocketRealtimePublisher } from "src/websocket/realtime.publisher.service";
import { SessionSocketsRevalidationCron } from "src/websocket/session-sockets-revalidation.cron";
import { SessionSocketsRevalidationService } from "src/websocket/session-sockets-revalidation.service";
import { WsGateway } from "src/websocket/websocket.gateway";

@Global()
@Module({
  providers: [
    WsGateway,
    WsJwtGuard,
    SocketRealtimePublisher,
    SessionSocketsDisconnectHandler,
    SessionSocketsRevalidationService,
    SessionSocketsRevalidationCron,
    { provide: REALTIME_PUBLISHER, useExisting: SocketRealtimePublisher },
  ],
  exports: [WsGateway, WsJwtGuard, REALTIME_PUBLISHER],
})
export class WebSocketModule {}
