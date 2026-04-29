import { Logger, UseGuards } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from "@nestjs/websockets";
import { Server } from "socket.io";

import { CourseChatPresenceService } from "src/course-chat/course-chat-presence.service";
import {
  COURSE_CHAT_SOCKET_EVENTS,
  getCourseChatRoom,
} from "src/course-chat/course-chat.constants";
import { CourseChatService } from "src/course-chat/course-chat.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { WsJwtGuard } from "src/websocket/guards/ws-jwt.guard";
import { AuthenticatedSocket } from "src/websocket/websocket.types";

import type { OnGatewayDisconnect } from "@nestjs/websockets";
import type { UUIDType } from "src/common";

type CourseChatRoomPayload = {
  courseId: UUIDType;
};

@WebSocketGateway({
  namespace: "/ws",
  path: "/api/ws",
  transports: ["websocket", "polling"],
})
export class CourseChatGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CourseChatGateway.name);

  constructor(
    private readonly courseChatService: CourseChatService,
    private readonly courseChatPresenceService: CourseChatPresenceService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  handleDisconnect(client: AuthenticatedSocket) {
    const changes = this.courseChatPresenceService.disconnect(client.id);
    for (const change of changes) {
      this.emitPresenceChange(change.courseId, change.userId, change.isOnline);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(COURSE_CHAT_SOCKET_EVENTS.JOIN)
  async handleJoinCourseChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: CourseChatRoomPayload,
  ) {
    const { courseId } = payload;
    const user = client.data.user;

    if (!courseId) throw new WsException("courseChat.errors.courseIdRequired");

    try {
      await this.tenantDbRunnerService.runWithTenant(user.tenantId, () =>
        this.courseChatService.assertUserEnrolledInCourse(courseId, user.userId),
      );
    } catch (error) {
      this.logger.debug(`Course chat join rejected for user ${user.userId}: ${error}`);
      throw new WsException("courseChat.errors.notEnrolled");
    }

    const room = getCourseChatRoom(courseId);
    await client.join(room);
    const presenceChange = this.courseChatPresenceService.join(courseId, user.userId, client.id);
    if (presenceChange) {
      this.emitPresenceChange(courseId, user.userId, presenceChange.isOnline);
    }

    this.logger.debug(`User ${user.userId} joined course chat room: ${room}`);

    return { success: true, room };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(COURSE_CHAT_SOCKET_EVENTS.LEAVE)
  async handleLeaveCourseChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: CourseChatRoomPayload,
  ) {
    const { courseId } = payload;
    if (!courseId) throw new WsException("courseChat.errors.courseIdRequired");

    const room = getCourseChatRoom(courseId);
    await client.leave(room);
    const presenceChange = this.courseChatPresenceService.leave(
      courseId,
      client.data.user.userId,
      client.id,
    );
    if (presenceChange) {
      this.emitPresenceChange(courseId, client.data.user.userId, presenceChange.isOnline);
    }

    this.logger.debug(`User ${client.data.user.userId} left course chat room: ${room}`);

    return { success: true };
  }

  private emitPresenceChange(courseId: UUIDType, userId: UUIDType, isOnline: boolean) {
    this.server
      .to(getCourseChatRoom(courseId))
      .emit(COURSE_CHAT_SOCKET_EVENTS.USER_PRESENCE_CHANGED, {
        courseId,
        userId,
        isOnline,
      });
  }
}
