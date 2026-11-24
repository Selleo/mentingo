import { UseGuards } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import { ASSISTANT_SOCKET_EVENTS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { UUIDSchema } from "src/common";
import { isTenantAccessActive } from "src/common/utils/tenantAccess";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { WsJwtGuard } from "src/websocket/guards/ws-jwt.guard";
import { AuthenticatedSocket } from "src/websocket/websocket.types";

import { assistantThreadRoom } from "./assistant-realtime.service";
import { AssistantRepository } from "./assistant.repository";

const threadSubscription = Type.Object(
  { threadId: UUIDSchema, userId: UUIDSchema },
  { additionalProperties: false },
);

@WebSocketGateway({ namespace: "/ws", path: "/api/ws", transports: ["websocket", "polling"] })
@UseGuards(WsJwtGuard)
export class AssistantGateway {
  constructor(
    private readonly assistantRepository: AssistantRepository,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  @SubscribeMessage(ASSISTANT_SOCKET_EVENTS.JOIN)
  async join(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() payload: unknown) {
    if (!Value.Check(threadSubscription, payload)) return { success: false };
    const user = socket.data.user;
    if (payload.userId !== user.userId) return { success: false };

    try {
      const allowed = await this.tenantDbRunnerService.runWithTenant(user.tenantId, async () => {
        const [tenant, actorIsActive, ownsThread] = await Promise.all([
          this.assistantRepository.findTenantState(user.tenantId),
          this.assistantRepository.isAccountActive(user),
          this.assistantRepository.ownsThread(user, payload.threadId),
        ]);
        return tenant && isTenantAccessActive(tenant) && actorIsActive && ownsThread;
      });
      if (!allowed || !socket.connected) return { success: false };

      await socket.join(assistantThreadRoom(user, payload.threadId));
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  @SubscribeMessage(ASSISTANT_SOCKET_EVENTS.LEAVE)
  async leave(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() payload: unknown) {
    if (!Value.Check(threadSubscription, payload)) return { success: false };
    const user = socket.data.user;
    if (payload.userId !== user.userId) return { success: false };
    await socket.leave(assistantThreadRoom(user, payload.threadId));
    return { success: true };
  }
}
