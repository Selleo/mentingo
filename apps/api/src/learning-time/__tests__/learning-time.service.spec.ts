import { faker } from "@faker-js/faker";

import { LearningTimeRepository } from "src/learning-time/learning-time.repository";
import { LearningTimeService } from "src/learning-time/learning-time.service";

import { createUnitTest } from "../../../test/create-unit-test";
import {
  createLearningTimeFactory,
  createLearningTimeTestSetup,
} from "../../../test/factory/learning-time.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { truncateTables } from "../../../test/helpers/test-helpers";

import type { TestContext } from "../../../test/create-unit-test";
import type { DatabasePg } from "src/common";
import type {
  AuthenticatedSocket,
  HeartbeatPayload,
  JoinLessonPayload,
  LeaveLessonPayload,
} from "src/websocket/websocket.types";

describe("LearningTimeService (unit)", () => {
  let testContext: TestContext;
  let db: DatabasePg;
  let service: LearningTimeService;
  let repository: LearningTimeRepository;
  let learningTimeFactory: ReturnType<typeof createLearningTimeFactory>;
  let userFactory: ReturnType<typeof createUserFactory>;

  beforeAll(async () => {
    testContext = await createUnitTest();
    await testContext.module.init();

    service = testContext.module.get(LearningTimeService);
    repository = testContext.module.get(LearningTimeRepository);
    db = testContext.db;

    learningTimeFactory = createLearningTimeFactory(db);
    userFactory = createUserFactory(db);
  }, 60000);

  afterAll(async () => {
    await truncateTables(db, [
      "lesson_learning_time",
      "lessons",
      "chapters",
      "courses",
      "categories",
      "users",
    ]);
    await testContext.teardown();
  });

  const createMockSocket = (userId: string): AuthenticatedSocket =>
    ({
      id: faker.string.uuid(),
      data: {
        user: {
          userId,
          email: faker.internet.email(),
          role: "student",
        },
      },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      handshake: { auth: {} },
    }) as unknown as AuthenticatedSocket;

  describe("getLearningTimeStatistics", () => {
    it("should return statistics for a course", async () => {
      const { courseId, lessonId } = await createLearningTimeTestSetup(db);
      const user1 = await userFactory.create();
      const user2 = await userFactory.create();

      await repository.addLearningTime(user1.id, lessonId, courseId, 100);
      await repository.addLearningTime(user2.id, lessonId, courseId, 200);

      const stats = await service.getLearningTimeStatistics(courseId);

      expect(stats.courseTotals.totalSeconds).toBe(300);
      expect(stats.courseTotals.uniqueUsers).toBe(2);
      expect(stats.averagePerLesson.length).toBeGreaterThanOrEqual(1);
      expect(stats.totalPerStudent.length).toBe(2);
    });

    it("should return empty statistics for course with no data", async () => {
      const { courseId } = await createLearningTimeTestSetup(db);

      const stats = await service.getLearningTimeStatistics(courseId);

      expect(stats.courseTotals.totalSeconds).toBe(0);
      expect(stats.courseTotals.uniqueUsers).toBe(0);
      expect(stats.averagePerLesson).toEqual([]);
      expect(stats.totalPerStudent).toEqual([]);
    });
  });

  describe("getDetailedLearningTime", () => {
    it("should return detailed learning time records", async () => {
      const learningTime = await learningTimeFactory.create({
        totalSeconds: 500,
      });

      const details = await service.getDetailedLearningTime(learningTime.courseId);

      expect(details.length).toBeGreaterThanOrEqual(1);
      const record = details.find((d) => d.lessonId === learningTime.lessonId);
      expect(record).toBeDefined();
      expect(record?.totalSeconds).toBe(500);
    });
  });

  describe("handler methods (internal logic)", () => {
    // Access private methods for testing via type assertion
    const getPrivateMethods = (svc: LearningTimeService) => {
      return svc as unknown as {
        handleJoinLesson: (
          socket: AuthenticatedSocket,
          payload: JoinLessonPayload,
        ) => Promise<void>;
        handleLeaveLesson: (
          socket: AuthenticatedSocket,
          payload: LeaveLessonPayload,
        ) => Promise<void>;
        handleHeartbeat: (socket: AuthenticatedSocket, payload: HeartbeatPayload) => Promise<void>;
        handleDisconnect: (socket: AuthenticatedSocket) => Promise<void>;
        getSession: (key: string) => Promise<unknown>;
        getSessionKey: (userId: string, lessonId: string, socketId: string) => string;
      };
    };

    it("handleJoinLesson should create session in cache", async () => {
      const { lessonId, courseId } = await createLearningTimeTestSetup(db);
      const user = await userFactory.create();
      const socket = createMockSocket(user.id);

      const privateMethods = getPrivateMethods(service);

      await privateMethods.handleJoinLesson(socket, { lessonId, courseId });

      const sessionKey = privateMethods.getSessionKey(user.id, lessonId, socket.id);
      const session = await privateMethods.getSession(sessionKey);

      expect(session).toBeDefined();
      expect((session as { lessonId: string }).lessonId).toBe(lessonId);
      expect((session as { accumulatedSeconds: number }).accumulatedSeconds).toBe(0);
    });

    it("handleHeartbeat should accumulate time when active", async () => {
      const { lessonId, courseId } = await createLearningTimeTestSetup(db);
      const user = await userFactory.create();
      const socket = createMockSocket(user.id);

      const privateMethods = getPrivateMethods(service);

      await privateMethods.handleJoinLesson(socket, { lessonId, courseId });

      await privateMethods.handleHeartbeat(socket, {
        lessonId,
        courseId,
        timestamp: Date.now(),
        isActive: true,
      });

      const sessionKey = privateMethods.getSessionKey(user.id, lessonId, socket.id);
      const session = await privateMethods.getSession(sessionKey);

      expect((session as { accumulatedSeconds: number }).accumulatedSeconds).toBe(10); // HEARTBEAT_INTERVAL
    });

    it("handleHeartbeat should not accumulate time when idle", async () => {
      const { lessonId, courseId } = await createLearningTimeTestSetup(db);
      const user = await userFactory.create();
      const socket = createMockSocket(user.id);

      const privateMethods = getPrivateMethods(service);

      await privateMethods.handleJoinLesson(socket, { lessonId, courseId });

      await privateMethods.handleHeartbeat(socket, {
        lessonId,
        courseId,
        timestamp: Date.now(),
        isActive: false,
      });

      const sessionKey = privateMethods.getSessionKey(user.id, lessonId, socket.id);
      const session = await privateMethods.getSession(sessionKey);

      expect((session as { accumulatedSeconds: number }).accumulatedSeconds).toBe(0);
    });

    it("handleHeartbeat should create session if not exists", async () => {
      const { lessonId, courseId } = await createLearningTimeTestSetup(db);
      const user = await userFactory.create();
      const socket = createMockSocket(user.id);

      const privateMethods = getPrivateMethods(service);

      await privateMethods.handleHeartbeat(socket, {
        lessonId,
        courseId,
        timestamp: Date.now(),
        isActive: true,
      });

      const sessionKey = privateMethods.getSessionKey(user.id, lessonId, socket.id);
      const session = await privateMethods.getSession(sessionKey);

      expect(session).toBeDefined();
      expect((session as { accumulatedSeconds: number }).accumulatedSeconds).toBe(0);
    });

    it("handleLeaveLesson should flush accumulated time to queue", async () => {
      const { lessonId, courseId } = await createLearningTimeTestSetup(db);
      const user = await userFactory.create();
      const socket = createMockSocket(user.id);

      const privateMethods = getPrivateMethods(service);

      await privateMethods.handleJoinLesson(socket, { lessonId, courseId });

      for (let i = 0; i < 3; i++) {
        await privateMethods.handleHeartbeat(socket, {
          lessonId,
          courseId,
          timestamp: Date.now(),
          isActive: true,
        });
      }

      await privateMethods.handleLeaveLesson(socket, { lessonId });

      const sessionKey = privateMethods.getSessionKey(user.id, lessonId, socket.id);
      const session = await privateMethods.getSession(sessionKey);
      expect(session).toBeNull();
    });
  });
});
