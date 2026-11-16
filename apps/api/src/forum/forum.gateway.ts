import { Logger, UseGuards } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from "@nestjs/websockets";
import { FORUM_SOCKET_EVENTS, PERMISSIONS, getForumRoom, getForumTopicRoom } from "@repo/shared";

import { hasPermission } from "src/common/permissions/permission.utils";
import { ForumService } from "src/forum/forum.service";
import { SettingsService } from "src/settings/settings.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { WsJwtGuard } from "src/websocket/guards/ws-jwt.guard";
import { AuthenticatedSocket } from "src/websocket/websocket.types";

import type { UUIDType } from "src/common";
import type { WsUser } from "src/websocket/websocket.types";

type ForumTopicRoomPayload = {
  topicId: UUIDType;
};

@WebSocketGateway({
  namespace: "/ws",
  path: "/api/ws",
  transports: ["websocket", "polling"],
})
export class ForumGateway {
  private readonly logger = new Logger(ForumGateway.name);

  constructor(
    private readonly forumService: ForumService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly settingsService: SettingsService,
  ) {}

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(FORUM_SOCKET_EVENTS.JOIN)
  async handleJoinForum(@ConnectedSocket() client: AuthenticatedSocket) {
    const user = client.data.user;
    await this.assertForumReadable(user);

    const room = getForumRoom(user.tenantId);
    await client.join(room);

    return { success: true, room };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(FORUM_SOCKET_EVENTS.LEAVE)
  async handleLeaveForum(@ConnectedSocket() client: AuthenticatedSocket) {
    await client.leave(getForumRoom(client.data.user.tenantId));

    return { success: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(FORUM_SOCKET_EVENTS.JOIN_TOPIC)
  async handleJoinTopic(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ForumTopicRoomPayload,
  ) {
    const { topicId } = payload;
    const user = client.data.user;

    if (!topicId) throw new WsException("forum.errors.topicNotFound");

    await this.assertForumReadable(user);

    try {
      await this.tenantDbRunnerService.runWithTenant(user.tenantId, () =>
        this.forumService.assertTopicAccessible(topicId, user),
      );
    } catch (error) {
      this.logger.debug(`Forum topic join rejected for user ${user.userId}: ${error}`);
      throw new WsException("forum.errors.topicNotFound");
    }

    const room = getForumTopicRoom(topicId);
    await client.join(room);

    return { success: true, room };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(FORUM_SOCKET_EVENTS.LEAVE_TOPIC)
  async handleLeaveTopic(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ForumTopicRoomPayload,
  ) {
    if (!payload.topicId) throw new WsException("forum.errors.topicNotFound");

    await client.leave(getForumTopicRoom(payload.topicId));

    return { success: true };
  }

  private async assertForumReadable(user: WsUser) {
    const globalSettings = await this.settingsService.getGlobalSettingsByTenantId(user.tenantId);

    if (!globalSettings.forumEnabled) throw new WsException("features.error.disabled");

    if (!hasPermission(user.permissions, PERMISSIONS.FORUM_READ)) {
      throw new WsException("auth.error.missingPermission");
    }
  }
}
