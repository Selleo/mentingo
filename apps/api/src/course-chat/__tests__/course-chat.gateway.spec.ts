import { WsException } from "@nestjs/websockets";

import { CourseChatGateway } from "src/course-chat/course-chat.gateway";

import type { CourseChatPresenceService } from "src/course-chat/course-chat-presence.service";
import type { CourseChatService } from "src/course-chat/course-chat.service";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import type { AuthenticatedSocket } from "src/websocket/websocket.types";

const userId = "00000000-0000-0000-0000-000000000001";
const courseId = "00000000-0000-0000-0000-000000000002";
const tenantId = "00000000-0000-0000-0000-000000000003";

describe("CourseChatGateway", () => {
  let courseChatService: jest.Mocked<CourseChatService>;
  let courseChatPresenceService: jest.Mocked<CourseChatPresenceService>;
  let tenantDbRunnerService: jest.Mocked<TenantDbRunnerService>;
  let gateway: CourseChatGateway;
  let socket: AuthenticatedSocket;

  beforeEach(() => {
    courseChatService = {
      assertUserEnrolledInCourse: jest.fn(),
    } as unknown as jest.Mocked<CourseChatService>;

    courseChatPresenceService = {
      join: jest.fn().mockReturnValue({ courseId, userId, isOnline: true }),
      leave: jest.fn(),
      disconnect: jest.fn().mockReturnValue([]),
      isOnline: jest.fn(),
    } as unknown as jest.Mocked<CourseChatPresenceService>;

    tenantDbRunnerService = {
      runWithTenant: jest.fn((_tenantId, fn) => fn()),
    } as unknown as jest.Mocked<TenantDbRunnerService>;

    gateway = new CourseChatGateway(
      courseChatService,
      courseChatPresenceService,
      tenantDbRunnerService,
    );
    gateway.server = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) } as never;
    socket = {
      id: "socket-1",
      data: {
        user: {
          userId,
          email: "student@example.com",
          roleSlugs: [],
          permissions: [],
          tenantId,
        },
      },
      join: jest.fn(),
      leave: jest.fn(),
    } as unknown as AuthenticatedSocket;
  });

  it("joins the course chat room for enrolled users", async () => {
    courseChatService.assertUserEnrolledInCourse.mockResolvedValue(undefined);

    const result = await gateway.handleJoinCourseChat(socket, { courseId });

    expect(tenantDbRunnerService.runWithTenant).toHaveBeenCalledWith(
      tenantId,
      expect.any(Function),
    );
    expect(courseChatService.assertUserEnrolledInCourse).toHaveBeenCalledWith(courseId, userId);
    expect(socket.join).toHaveBeenCalledWith(`course-chat:${courseId}`);
    expect(courseChatPresenceService.join).toHaveBeenCalledWith(courseId, userId, "socket-1");
    expect(result).toEqual({ success: true, room: `course-chat:${courseId}` });
  });

  it("rejects room joins for users without enrollment", async () => {
    courseChatService.assertUserEnrolledInCourse.mockRejectedValue(new Error("forbidden"));

    await expect(gateway.handleJoinCourseChat(socket, { courseId })).rejects.toBeInstanceOf(
      WsException,
    );
    expect(socket.join).not.toHaveBeenCalled();
  });
});
