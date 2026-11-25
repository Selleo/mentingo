import { PERMISSIONS } from "@repo/shared";

import { LearningTimeService } from "./learning-time.service";

import type { PermissionKey } from "@repo/shared";
import type {
  AuthenticatedSocket,
  HeartbeatPayload,
  JoinLessonPayload,
} from "src/websocket/websocket.types";

function createService(permissions: PermissionKey[] = [PERMISSIONS.LEARNING_PROGRESS_UPDATE]) {
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
    getEnrolledLessonLearningAccess: jest.fn().mockResolvedValue(null),
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
        permissions,
      },
    },
  } as unknown as AuthenticatedSocket;
  return { handlers, socket, learningTimeRepository, tenantDbRunnerService, cacheManager };
}

const payload = { lessonId: "lesson", courseId: "client-course" };
const enrolledAccess = {
  courseId: "actual-course",
  authorId: "author",
  isLearningModeActive: false,
};
const contentCreatorPermissions = [
  PERMISSIONS.LEARNING_PROGRESS_UPDATE,
  PERMISSIONS.LEARNING_MODE_USE,
  PERMISSIONS.COURSE_UPDATE_OWN,
];

describe("LearningTimeService preview protection", () => {
  it("does not start a session or accept heartbeats for an unenrolled previewer", async () => {
    const { handlers, socket, cacheManager, learningTimeRepository } = createService();

    await handlers.join?.(socket, payload);
    await handlers.heartbeat?.(socket, { ...payload, timestamp: Date.now(), isActive: true });

    expect(learningTimeRepository.getEnrolledLessonLearningAccess).toHaveBeenCalledWith(
      "lesson",
      "student",
    );
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it("starts an enrolled learner session in the tenant using the actual lesson course", async () => {
    const { handlers, socket, learningTimeRepository, tenantDbRunnerService, cacheManager } =
      createService();
    learningTimeRepository.getEnrolledLessonLearningAccess.mockResolvedValue(enrolledAccess);

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
    learningTimeRepository.getEnrolledLessonLearningAccess.mockResolvedValue(enrolledAccess);
    await handlers.join?.(socket, payload);
    cacheManager.set.mockClear();
    learningTimeRepository.getEnrolledLessonLearningAccess.mockResolvedValue(null);

    await handlers.heartbeat?.(socket, { ...payload, timestamp: Date.now(), isActive: true });

    expect(cacheManager.set).not.toHaveBeenCalled();
  });
});

describe("LearningTimeService learner tracking", () => {
  const sessionKey = "learning-session:student:lesson:socket";

  it("tracks an enrolled content creator learning someone else's course", async () => {
    const { handlers, socket, learningTimeRepository, cacheManager } =
      createService(contentCreatorPermissions);
    learningTimeRepository.getEnrolledLessonLearningAccess.mockResolvedValue(enrolledAccess);

    await handlers.join?.(socket, payload);

    expect(cacheManager.set).toHaveBeenCalledWith(
      sessionKey,
      expect.objectContaining({ courseId: "actual-course" }),
      expect.any(Number),
    );
  });

  it("tracks a course author only while learning mode is active", async () => {
    const { handlers, socket, learningTimeRepository, cacheManager } =
      createService(contentCreatorPermissions);
    learningTimeRepository.getEnrolledLessonLearningAccess.mockResolvedValue({
      ...enrolledAccess,
      authorId: "student",
    });

    await handlers.join?.(socket, payload);
    expect(cacheManager.set).not.toHaveBeenCalled();

    learningTimeRepository.getEnrolledLessonLearningAccess.mockResolvedValue({
      ...enrolledAccess,
      authorId: "student",
      isLearningModeActive: true,
    });
    await handlers.join?.(socket, payload);

    expect(cacheManager.set).toHaveBeenCalledWith(
      sessionKey,
      expect.objectContaining({ courseId: "actual-course" }),
      expect.any(Number),
    );
  });

  it("registers a session restarted by a heartbeat so a disconnect still flushes it", async () => {
    const { handlers, socket, learningTimeRepository, cacheManager } = createService();
    learningTimeRepository.getEnrolledLessonLearningAccess.mockResolvedValue(enrolledAccess);

    await handlers.heartbeat?.(socket, { ...payload, timestamp: Date.now(), isActive: true });

    expect(cacheManager.set).toHaveBeenCalledWith(
      "socket-sessions:socket",
      [sessionKey],
      expect.any(Number),
    );
  });
});
