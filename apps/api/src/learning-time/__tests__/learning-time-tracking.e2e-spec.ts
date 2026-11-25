import { faker } from "@faker-js/faker";
import { SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_SLUGS, type SystemRoleSlug } from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { LearningTimeRepository } from "src/learning-time/learning-time.repository";
import { LearningTimeService } from "src/learning-time/learning-time.service";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { studentCourses } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createStudentCourseFactory } from "../../../test/factory/student-course.factory";
import {
  COURSE_ENROLLMENT_TABLES,
  createCourseEnrollmentHelpers,
} from "../../../test/helpers/course-enrollment";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  COURSE_AUTHORSHIP,
  HEARTBEAT_SECONDS,
  LEARNER_ACCESS,
  LEARNER_ACCESS_CASES,
  SESSION_LIFECYCLE_CASES,
  SESSION_STEPS,
  TRACKED_COURSE_CONTENT,
} from "./learning-time-tracking.scenarios";

import type {
  CourseAuthorship,
  LearnerAccess,
  SessionStep,
} from "./learning-time-tracking.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { Job } from "bullmq";
import type { DatabasePg, UUIDType } from "src/common";
import type { AuthenticatedSocket } from "src/websocket/websocket.types";
import type { SignedInUser } from "test/helpers/course-enrollment";

const LEARNING_TIME_TABLES: Parameters<typeof truncateTables>[1] = [
  "lesson_learning_time",
  ...COURSE_ENROLLMENT_TABLES,
];

const cacheEntries = new Map<string, unknown>();

const cacheManagerDouble = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const applyCacheManagerDefaults = () => {
  cacheManagerDouble.get.mockImplementation(async (key: string) => cacheEntries.get(key));
  cacheManagerDouble.set.mockImplementation(async (key: string, value: unknown) => {
    cacheEntries.set(key, value);
  });
  cacheManagerDouble.del.mockImplementation(async (key: string) => {
    cacheEntries.delete(key);
  });
};

describe("Learning time tracking (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let helpers: ReturnType<typeof createCourseEnrollmentHelpers>;
  let learningTimeService: LearningTimeService;
  let learningTimeRepository: LearningTimeRepository;
  let queueService: QueueService;
  let enqueueSpy: jest.SpyInstance<ReturnType<QueueService["enqueue"]>>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [{ provide: "CACHE_MANAGER", useValue: cacheManagerDouble }],
    });
    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    helpers = createCourseEnrollmentHelpers({ app, db, runInTenant });
    learningTimeService = app.get(LearningTimeService);
    learningTimeRepository = app.get(LearningTimeRepository);
    queueService = app.get(QueueService);
    enqueueSpy = jest.spyOn(queueService, "enqueue");
  });

  afterAll(async () => {
    enqueueSpy.mockRestore();
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, LEARNING_TIME_TABLES);
    cacheEntries.clear();
    Object.values(cacheManagerDouble).forEach((mock) => mock.mockReset());
    applyCacheManagerDefaults();
    enqueueSpy.mockClear();
    await helpers.arrangeGlobalSettings();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, LEARNING_TIME_TABLES);
  });

  const createLearnerSocket = (learner: SignedInUser, roleSlug: SystemRoleSlug) =>
    ({
      id: faker.string.uuid(),
      data: {
        user: {
          userId: learner.user.id,
          tenantId: learner.user.tenantId,
          permissions: [...SYSTEM_ROLE_PERMISSIONS[roleSlug]],
        },
      },
    }) as AuthenticatedSocket;

  const setLearningMode = (learner: SignedInUser, courseId: UUIDType, enabled: boolean) =>
    request(app.getHttpServer())
      .patch(`/api/course/${courseId}/student-mode`)
      .set("Cookie", learner.cookies)
      .send({ enabled })
      .expect(200);

  const arrangeCourseAuthor = (learner: SignedInUser, authorship: CourseAuthorship) =>
    match(authorship)
      .with(COURSE_AUTHORSHIP.AUTHOR, async () => learner.user)
      .with(COURSE_AUTHORSHIP.OTHER_AUTHOR, () => helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN))
      .exhaustive();

  const arrangeLearnerAccess = (learner: SignedInUser, courseId: UUIDType, access: LearnerAccess) =>
    match(access)
      .with(LEARNER_ACCESS.NOT_ENROLLED, async () => undefined)
      .with(LEARNER_ACCESS.ENROLLED, () =>
        runInTenant(() =>
          createStudentCourseFactory(db).create({ studentId: learner.user.id, courseId }),
        ),
      )
      .with(LEARNER_ACCESS.LEARNING_MODE, () => setLearningMode(learner, courseId, true))
      .with(LEARNER_ACCESS.LEARNING_MODE_TURNED_OFF, async () => {
        await setLearningMode(learner, courseId, true);
        await setLearningMode(learner, courseId, false);
      })
      .exhaustive();

  const arrangeLearnerOnLesson = async ({
    roleSlug,
    authorship,
    access,
  }: {
    roleSlug: SystemRoleSlug;
    authorship: CourseAuthorship;
    access: LearnerAccess;
  }) => {
    const learner = await helpers.arrangeSignedInUser(roleSlug);
    const author = await arrangeCourseAuthor(learner, authorship);
    const { course, chapters } = await helpers.arrangeCourseWithContent({
      authorId: author.id,
      contentShape: TRACKED_COURSE_CONTENT,
    });
    await arrangeLearnerAccess(learner, course.id, access);

    return {
      learner,
      socket: createLearnerSocket(learner, roleSlug),
      courseId: course.id,
      lessonId: chapters[0].lessons[0].id,
    };
  };

  const driveLearningSession = async (
    socket: AuthenticatedSocket,
    lesson: { lessonId: UUIDType; courseId: UUIDType },
    steps: SessionStep[],
  ) => {
    const sendHeartbeat = (isActive: boolean) =>
      learningTimeService["handleHeartbeat"](socket, {
        ...lesson,
        timestamp: Date.now(),
        isActive,
      });

    for (const step of steps) {
      await match(step)
        .with(SESSION_STEPS.JOIN, () => learningTimeService["handleJoinLesson"](socket, lesson))
        .with(SESSION_STEPS.ACTIVE_HEARTBEAT, () => sendHeartbeat(true))
        .with(SESSION_STEPS.IDLE_HEARTBEAT, () => sendHeartbeat(false))
        .with(SESSION_STEPS.LEAVE, () => learningTimeService["handleLeaveLesson"](socket, lesson))
        .with(SESSION_STEPS.DISCONNECT, () => learningTimeService["handleDisconnect"](socket))
        .with(SESSION_STEPS.EXPIRE_LESSON_SESSION, async () => {
          cacheEntries.delete(
            learningTimeService["getSessionKey"](
              socket.data.user.userId,
              lesson.lessonId,
              socket.id,
            ),
          );
        })
        .with(SESSION_STEPS.EXPIRE_SOCKET_SESSIONS, async () => {
          cacheEntries.delete(learningTimeService["getSocketSessionsKey"](socket.id));
        })
        .exhaustive();
    }
  };

  const waitForEnqueuedLearningTimeJobs = async () => {
    const jobs: Job[] = await Promise.all(
      enqueueSpy.mock.calls.flatMap(([queueName], callIndex) =>
        queueName === QUEUE_NAMES.LEARNING_TIME ? [enqueueSpy.mock.results[callIndex].value] : [],
      ),
    );
    await queueService.waitForJobsCompletion(QUEUE_NAMES.LEARNING_TIME, jobs);
  };

  const findRecordedSeconds = async (userId: UUIDType, lessonId: UUIDType) => {
    await waitForEnqueuedLearningTimeJobs();

    return runInTenant(() => learningTimeRepository.getLearningTimeForUser(userId, lessonId));
  };

  describe("who is tracked", () => {
    it.each(LEARNER_ACCESS_CASES)(
      "records $expectedSeconds s for a $roleSlug who is $access when $authorship",
      async ({ expectedSeconds, ...learnerCase }) => {
        const { learner, socket, ...lesson } = await arrangeLearnerOnLesson(learnerCase);

        await driveLearningSession(socket, lesson, [
          SESSION_STEPS.JOIN,
          SESSION_STEPS.ACTIVE_HEARTBEAT,
          SESSION_STEPS.LEAVE,
        ]);

        expect(await findRecordedSeconds(learner.user.id, lesson.lessonId)).toBe(expectedSeconds);
      },
    );

    it("stops recording once the learner is unenrolled mid-session", async () => {
      const { learner, socket, ...lesson } = await arrangeLearnerOnLesson({
        roleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
        authorship: COURSE_AUTHORSHIP.OTHER_AUTHOR,
        access: LEARNER_ACCESS.ENROLLED,
      });

      await driveLearningSession(socket, lesson, [
        SESSION_STEPS.JOIN,
        SESSION_STEPS.ACTIVE_HEARTBEAT,
      ]);
      await runInTenant(() =>
        db.delete(studentCourses).where(eq(studentCourses.studentId, learner.user.id)),
      );
      await driveLearningSession(socket, lesson, [
        SESSION_STEPS.ACTIVE_HEARTBEAT,
        SESSION_STEPS.ACTIVE_HEARTBEAT,
        SESSION_STEPS.LEAVE,
      ]);

      expect(await findRecordedSeconds(learner.user.id, lesson.lessonId)).toBe(HEARTBEAT_SECONDS);
    });
  });

  describe("session lifecycle", () => {
    it.each(SESSION_LIFECYCLE_CASES)("$behaviour", async ({ steps, expectedSeconds }) => {
      const { learner, socket, ...lesson } = await arrangeLearnerOnLesson({
        roleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
        authorship: COURSE_AUTHORSHIP.OTHER_AUTHOR,
        access: LEARNER_ACCESS.ENROLLED,
      });

      await driveLearningSession(socket, lesson, steps);

      expect(await findRecordedSeconds(learner.user.id, lesson.lessonId)).toBe(expectedSeconds);
    });

    it("keeps separate totals for two tabs of the same learner", async () => {
      const { learner, socket, ...lesson } = await arrangeLearnerOnLesson({
        roleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
        authorship: COURSE_AUTHORSHIP.OTHER_AUTHOR,
        access: LEARNER_ACCESS.ENROLLED,
      });
      const secondTab = createLearnerSocket(learner, SYSTEM_ROLE_SLUGS.STUDENT);

      await driveLearningSession(socket, lesson, [
        SESSION_STEPS.JOIN,
        SESSION_STEPS.ACTIVE_HEARTBEAT,
      ]);
      await driveLearningSession(secondTab, lesson, [
        SESSION_STEPS.JOIN,
        SESSION_STEPS.ACTIVE_HEARTBEAT,
        SESSION_STEPS.ACTIVE_HEARTBEAT,
        SESSION_STEPS.DISCONNECT,
      ]);
      await driveLearningSession(socket, lesson, [SESSION_STEPS.LEAVE]);

      expect(await findRecordedSeconds(learner.user.id, lesson.lessonId)).toBe(30);
    });
  });

  it("shows time tracked for an enrolled content creator in the course learning time statistics", async () => {
    const { learner, socket, ...lesson } = await arrangeLearnerOnLesson({
      roleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
      authorship: COURSE_AUTHORSHIP.OTHER_AUTHOR,
      access: LEARNER_ACCESS.ENROLLED,
    });
    const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);

    await driveLearningSession(socket, lesson, [
      SESSION_STEPS.JOIN,
      SESSION_STEPS.ACTIVE_HEARTBEAT,
      SESSION_STEPS.ACTIVE_HEARTBEAT,
      SESSION_STEPS.LEAVE,
    ]);
    await waitForEnqueuedLearningTimeJobs();

    const response = await request(app.getHttpServer())
      .get(`/api/course/${lesson.courseId}/statistics/learning-time`)
      .set("Cookie", admin.cookies)
      .expect(200);

    expect(response.body.data.users).toEqual([
      expect.objectContaining({ id: learner.user.id, totalSeconds: 20 }),
    ]);
  });
});
