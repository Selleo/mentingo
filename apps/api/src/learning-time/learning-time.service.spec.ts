import { PERMISSIONS } from "@repo/shared";

import { LearningTimeService } from "./learning-time.service";

import type {
  AuthenticatedSocket,
  HeartbeatPayload,
  JoinLessonPayload,
} from "src/websocket/websocket.types";

function createService() {
  const handlers: {
    join?: (socket: AuthenticatedSocket, payload: JoinLessonPayload) => Promise<void>;
    heartbeat?: (socket: AuthenticatedSocket, payload: HeartbeatPayload) => Promise<void>;
  } = {};
  const tenantDbRunnerService = {
    runWithTenant: jest.fn(async (_tenantId: string, callback: () => Promise<unknown>) =>
      callback(),
    ),
  };
  const learningTimeRepository = {
    getEnrolledCourseIdByLessonId: jest.fn().mockResolvedValue(null),
  };
  const wsGateway = {
    onJoinLesson: jest.fn((handler: NonNullable<typeof handlers.join>) => {
      handlers.join = handler;
    }),
    onHeartbeat: jest.fn((handler: NonNullable<typeof handlers.heartbeat>) => {
      handlers.heartbeat = handler;
    }),
    onLeaveLesson: jest.fn(),
    onDisconnect: jest.fn(),
  };
  const cacheManager = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    del: jest.fn(),
  };
  const service = new LearningTimeService(
    tenantDbRunnerService as never,
    {} as never,
    learningTimeRepository as never,
    wsGateway as never,
    {} as never,
    {} as never,
    cacheManager as never,
  );
  service.onModuleInit();
  const socket = {
    id: "socket",
    data: {
      user: {
        userId: "student",
        tenantId: "tenant",
        permissions: [PERMISSIONS.LEARNING_PROGRESS_UPDATE],
      },
    },
  } as unknown as AuthenticatedSocket;
  return { handlers, socket, learningTimeRepository, tenantDbRunnerService, cacheManager };
}

const payload = { lessonId: "lesson", courseId: "client-course" };

describe("LearningTimeService preview protection", () => {
  it("does not start a session or accept heartbeats for an unenrolled previewer", async () => {
    const { handlers, socket, cacheManager, learningTimeRepository } = createService();

    await handlers.join?.(socket, payload);
    await handlers.heartbeat?.(socket, { ...payload, timestamp: Date.now(), isActive: true });

    expect(learningTimeRepository.getEnrolledCourseIdByLessonId).toHaveBeenCalledWith(
      "lesson",
      "student",
    );
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it("starts an enrolled learner session in the tenant using the actual lesson course", async () => {
    const { handlers, socket, learningTimeRepository, tenantDbRunnerService, cacheManager } =
      createService();
    learningTimeRepository.getEnrolledCourseIdByLessonId.mockResolvedValue("actual-course");

    await handlers.join?.(socket, payload);

    expect(tenantDbRunnerService.runWithTenant).toHaveBeenCalledWith(
      "tenant",
      expect.any(Function),
    );
    expect(cacheManager.set).toHaveBeenCalledWith(
      "learning-session:student:lesson:socket",
      expect.objectContaining({
        lessonId: "lesson",
        courseId: "actual-course",
        accumulatedSeconds: 0,
      }),
      expect.any(Number),
    );
  });

  it("rechecks enrollment before advancing a previously started session", async () => {
    const { handlers, socket, learningTimeRepository, cacheManager } = createService();
    learningTimeRepository.getEnrolledCourseIdByLessonId.mockResolvedValue("actual-course");
    await handlers.join?.(socket, payload);
    cacheManager.set.mockClear();
    learningTimeRepository.getEnrolledCourseIdByLessonId.mockResolvedValue(null);

    await handlers.heartbeat?.(socket, { ...payload, timestamp: Date.now(), isActive: true });

    expect(cacheManager.set).not.toHaveBeenCalled();
  });
});
