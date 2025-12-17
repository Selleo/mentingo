import { Global, Module } from "@nestjs/common";

import { WsJwtGuard } from "src/websocket/guards/ws-jwt.guard";
import { WsGateway } from "src/websocket/websocket.gateway";

@Global()
@Module({
  providers: [WsGateway, WsJwtGuard],
  exports: [WsGateway],
})
export class WebSocketModule {}
