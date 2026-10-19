import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  LESSON_TYPES,
  CERTIFICATE_VALIDITY_TYPES,
  CERTIFICATE_VALIDITY_UNITS,
  LIVE_TRAINING_DELIVERY_TYPES,
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
  SCORM_STANDARD,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { and, eq, sql } from "drizzle-orm";
import request from "supertest";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { PromptService } from "src/ai/services/prompt.service";
import { CertificatesService } from "src/certificates/certificates.service";
import { CourseService } from "src/courses/course.service";
import { LearningTimeService } from "src/learning-time/learning-time.service";
import { LessonVideoProgressRepository } from "src/lesson-video-progress/repositories/lesson-video-progress.repository";
import { LiveTrainingSessionsRepository } from "src/live-training/live-training-sessions/live-training-sessions.repository";
import { LiveTrainingSessionsService } from "src/live-training/live-training-sessions/live-training-sessions.service";
import { QueueService } from "src/queue";
import { QuizRuntimeRepository } from "src/quiz/repositories/quiz-runtime.repository";
import { ScormRepository } from "src/scorm/repositories/scorm.repository";
import { StatisticsRepository } from "src/statistics/repositories/statistics.repository";
import { dbAls } from "src/storage/db/db-als.store";
import { DB } from "src/storage/db/db.providers";
import {
  certificates,
  courseLearningStates,
  courses,
  coursesSummaryStats,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
  aiMentorLessons,
  aiMentorThreads,
  assessments,
  assessmentAttempts,
  lessonVideoProgress,
  resourceEntity,
  scormAttempts,
  scormPackages,
  scormScos,
  groupManagerGroups,
  aiJudgeConfigurations,
  aiJudgeCriteria,
  aiMentorJudgements,
  aiMentorThreadMessages,
  lessons,
  users,
} from "src/storage/schema";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createLessonFactory } from "../../../test/factory/lesson.factory";
import { createResourceFactory } from "../../../test/factory/resource.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { assignSystemRoleToUserInTests } from "../../../test/helpers/permission-role-helpers";
import { cookieFor } from "../../../test/helpers/test-helpers";
import { courseLearningContext } from "../course-learning-context";
import { activeLearningState, currentLearningState } from "../course-learning-state.sql";
import { CourseRepetitionService } from "../course-repetition.service";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { AuthenticatedSocket } from "src/websocket/websocket.types";

describe("Course repetition (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let inTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let repetitionService: CourseRepetitionService;

  beforeAll(async () => {
    const setup = await createE2ETest({ useDbProxy: true });
    app = setup.app;
    db = app.get(DB);
    inTenant = (fn) => setup.runAsTenant(setup.defaultTenantId, fn);
    repetitionService = app.get(CourseRepetitionService);
    jest
      .spyOn(
        app.get(CertificatesService) as unknown as {
          scheduleCertificateImagePrewarm(id: string): void;
        },
        "scheduleCertificateImagePrewarm",
      )
      .mockImplementation(() => {});
  });
  afterAll(async () => {
    await app?.close();
  });

  async function fixture(enabled = true, completed = true) {
    return inTenant(async () => {
      const user = await createUserFactory(db)
        .withCredentials({ password: "password123" })
        .withUserSettings(db)
        .create();
      const courseFactory = createCourseFactory(db);
      const course = await courseFactory.create({
        status: "published",
        chapterCount: 1,
        hasCertificate: false,
        settings: { ...courseFactory.build().settings, repetitionEnabled: enabled },
      });
      const chapter = await createChapterFactory(db).create({
        courseId: course.id,
        lessonCount: 1,
      });
      const lesson = await createLessonFactory(db).create({ chapterId: chapter.id });
      await db
        .insert(coursesSummaryStats)
        .values({ courseId: course.id, authorId: course.authorId });
      await db.insert(studentCourses).values({
        courseId: course.id,
        studentId: user.id,
        progress: completed ? "completed" : "in_progress",
        completedAt: completed ? "2026-01-01T12:00:00.000Z" : null,
        finishedChapterCount: completed ? 1 : 0,
      });
      await db.insert(studentChapterProgress).values({
        courseId: course.id,
        studentId: user.id,
        chapterId: chapter.id,
        completedLessonCount: completed ? 1 : 0,
        completedAt: completed ? "2026-01-01T12:00:00.000Z" : null,
      });
      await db.insert(studentLessonProgress).values({
        studentId: user.id,
        lessonId: lesson.id,
        chapterId: chapter.id,
        isStarted: true,
        completedAt: completed ? "2026-01-01T12:00:00.000Z" : null,
      });
      const current = await db.transaction((trx) =>
        repetitionService.ensureCurrent(course.id, user.id, trx),
      );
      return { user, course, chapter, lesson, current };
    });
  }

  async function mentorFixture(completed = false) {
    const f = await fixture(true, completed);
    return inTenant(async () => {
      await db
        .update(lessons)
        .set({ type: LESSON_TYPES.AI_MENTOR })
        .where(eq(lessons.id, f.lesson.id));
      const [mentor] = await db
        .insert(aiMentorLessons)
        .values({ lessonId: f.lesson.id })
        .returning();
      const [configuration] = await db
        .insert(aiJudgeConfigurations)
        .values({
          aiMentorLessonId: mentor.id,
          taskGoal: { en: "Explain the task" },
          passingThresholdPercent: 70,
        })
        .returning();
      await db.insert(aiJudgeCriteria).values({
        configurationId: configuration.id,
        title: { en: "Explanation" },
        expectedBehavior: { en: "Explain clearly" },
        maxScore: 1,
      });
      const thread = await app.get(AiRepository).createThread({
        aiMentorLessonId: mentor.id,
        userId: f.user.id,
        userLanguage: SUPPORTED_LANGUAGES.EN,
        status: "active",
      });
      await db
        .insert(aiMentorThreadMessages)
        .values({ threadId: thread.id, role: "user", content: "My explanation" });
      return { ...f, thread };
    });
  }

  const judgeResult = {
    criterionResults: [
      { criterionRef: "C1", awardedScore: 1, learnerSafeFeedback: "Clear explanation" },
    ],
    triggeredBlockingErrors: [],
  };

  it("counts learning time from an old tab before and after another tab starts repetition", async () => {
    const f = await fixture();
    const service = app.get(LearningTimeService);
    const enqueue = jest.spyOn(app.get(QueueService), "enqueue").mockResolvedValue(undefined!);
    const socket = {
      id: f.user.id,
      data: {
        user: {
          userId: f.user.id,
          tenantId: f.user.tenantId,
          permissions: [PERMISSIONS.LEARNING_PROGRESS_UPDATE],
        },
      },
    } as AuthenticatedSocket;
    const payload = { lessonId: f.lesson.id, courseId: f.course.id, learningStateId: f.current.id };
    try {
      await service["handleJoinLesson"](socket, payload);
      await inTenant(() => repetitionService.repeat(f.course.id, f.user.id, f.current.id));
      for (let i = 0; i < 6; i++) {
        await service["handleHeartbeat"](socket, {
          ...payload,
          timestamp: Date.now(),
          isActive: true,
        });
      }
      expect(enqueue).toHaveBeenCalledWith(
        "learning-time",
        "update-learning-time",
        expect.objectContaining({
          userId: f.user.id,
          lessonId: f.lesson.id,
          tenantId: f.user.tenantId,
          secondsToAdd: 60,
        }),
        expect.anything(),
      );
      await service["handleLeaveLesson"](socket, payload);
      enqueue.mockClear();
      await service["handleJoinLesson"](socket, payload);
      await service["handleHeartbeat"](socket, {
        ...payload,
        timestamp: Date.now(),
        isActive: true,
      });
      await service["handleLeaveLesson"](socket, payload);
      expect(enqueue).toHaveBeenCalledWith(
        "learning-time",
        "update-learning-time",
        expect.objectContaining({ secondsToAdd: 10 }),
        expect.anything(),
      );
      enqueue.mockClear();
      socket.data.user.permissions = [];
      await service["handleJoinLesson"](socket, payload);
      await service["handleHeartbeat"](socket, {
        ...payload,
        timestamp: Date.now(),
        isActive: true,
      });
      await service["handleLeaveLesson"](socket, payload);
      expect(enqueue).not.toHaveBeenCalled();
    } finally {
      await service["handleDisconnect"](socket);
      enqueue.mockRestore();
    }
  });

  it("generates the first AI welcome outside a transaction and reuses it on refresh", async () => {
    const f = await mentorFixture();
    await inTenant(() => db.delete(aiMentorThreads).where(eq(aiMentorThreads.id, f.thread.id)));
    const prompt = jest
      .spyOn(app.get(PromptService), "buildSystemPrompt")
      .mockImplementation(async () => {
        expect(dbAls.getStore()?.trx).toBeUndefined();
        return "Lesson system prompt";
      });
    const provider = jest
      .spyOn(app.get(AiRuntimeService), "generateMentorChat")
      .mockImplementation(async () => {
        expect(dbAls.getStore()?.trx).toBeUndefined();
        return "Welcome to the lesson";
      });
    try {
      const cookie = await cookieFor(f.user, app);
      const result = await request(app.getHttpServer())
        .get(`/api/lesson/${f.lesson.id}?language=en`)
        .set("Cookie", cookie)
        .expect(200);
      const refresh = await request(app.getHttpServer())
        .get(`/api/lesson/${f.lesson.id}?language=en`)
        .set("Cookie", cookie)
        .expect(200);
      expect(refresh.body.data.threadId).toBe(result.body.data.threadId);
      expect(provider).toHaveBeenCalledTimes(1);
      await inTenant(async () => {
        const welcome = await app
          .get(AiRepository)
          .findFirstMessageByRoleAndThread(result.body.data.threadId, "assistant");
        expect(welcome?.content).toBe("Welcome to the lesson");
      });
    } finally {
      prompt.mockRestore();
      provider.mockRestore();
    }
  });

  it("does not initialize an AI conversation when a former learner opens a manager preview", async () => {
    const f = await mentorFixture(true);
    const member = await fixture();
    await inTenant(async () => {
      await assignSystemRoleToUserInTests(
        db,
        f.user.id,
        f.user.tenantId,
        SYSTEM_ROLE_SLUGS.GROUP_MANAGER,
      );
      await db.delete(studentCourses).where(eq(studentCourses.studentId, f.user.id));
      await db.insert(studentCourses).values({ courseId: f.course.id, studentId: member.user.id });
      const group = await createGroupFactory(db).withMembers([member.user.id]).create();
      await db.insert(groupManagerGroups).values({ groupId: group.id, managerUserId: f.user.id });
    });
    const provider = jest.spyOn(app.get(AiRuntimeService), "generateMentorChat");
    try {
      await request(app.getHttpServer())
        .get(`/api/lesson/${f.lesson.id}?language=en`)
        .set("Cookie", await cookieFor(f.user, app))
        .expect(200);
      expect(provider).not.toHaveBeenCalled();
      await inTenant(async () => {
        expect(
          await app.get(AiRepository).findFirstMessageByRoleAndThread(f.thread.id, "assistant"),
        ).toBeUndefined();
      });
    } finally {
      provider.mockRestore();
    }
  });

  it("retries an unfinished AI welcome after a provider failure", async () => {
    const f = await mentorFixture();
    await inTenant(() => db.delete(aiMentorThreads).where(eq(aiMentorThreads.id, f.thread.id)));
    const prompt = jest
      .spyOn(app.get(PromptService), "buildSystemPrompt")
      .mockResolvedValue("Lesson system prompt");
    const provider = jest
      .spyOn(app.get(AiRuntimeService), "generateMentorChat")
      .mockRejectedValueOnce(new Error("Provider unavailable"))
      .mockResolvedValue("Welcome after retry");
    try {
      const cookie = await cookieFor(f.user, app);
      await request(app.getHttpServer())
        .get(`/api/lesson/${f.lesson.id}?language=en`)
        .set("Cookie", cookie)
        .expect(500);
      const retry = await request(app.getHttpServer())
        .get(`/api/lesson/${f.lesson.id}?language=en`)
        .set("Cookie", cookie)
        .expect(200);
      await inTenant(async () => {
        const threads = await db
          .select()
          .from(aiMentorThreads)
          .where(eq(aiMentorThreads.userId, f.user.id));
        expect(threads).toHaveLength(1);
        expect(retry.body.data.threadId).toBe(threads[0].id);
        const messages = await db
          .select()
          .from(aiMentorThreadMessages)
          .where(eq(aiMentorThreadMessages.threadId, threads[0].id));
        expect(messages.filter((message) => message.role === "system")).toHaveLength(1);
        expect(messages.filter((message) => message.role === "assistant")).toHaveLength(1);
      });
    } finally {
      prompt.mockRestore();
      provider.mockRestore();
    }
  });

  it.each(["repetition", "retake"])("rejects a late AI welcome after %s starts", async (action) => {
    const f = await mentorFixture(true);
    await inTenant(() => db.delete(aiMentorThreads).where(eq(aiMentorThreads.id, f.thread.id)));
    const prompt = jest
      .spyOn(app.get(PromptService), "buildSystemPrompt")
      .mockResolvedValue("Lesson system prompt");
    let release!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const generating = new Promise<void>((resolve) => {
      started = resolve;
    });
    const provider = jest
      .spyOn(app.get(AiRuntimeService), "generateMentorChat")
      .mockImplementation(async () => {
        expect(dbAls.getStore()?.trx).toBeUndefined();
        started();
        await pending;
        return "Outdated welcome";
      });
    const cookie = await cookieFor(f.user, app);
    const opening = request(app.getHttpServer())
      .get(`/api/lesson/${f.lesson.id}?language=en`)
      .set("Cookie", cookie)
      .then((response) => response);
    try {
      await generating;
      if (action === "repetition") {
        await inTenant(() => repetitionService.repeat(f.course.id, f.user.id, f.current.id));
      } else {
        await request(app.getHttpServer())
          .post(`/api/ai/retake/${f.lesson.id}`)
          .set("Cookie", cookie)
          .set("x-course-learning-state-id", f.current.id)
          .expect(201);
      }
      release();
      expect((await opening).status).toBe(409);
      await inTenant(async () => {
        const messages = await db
          .select()
          .from(aiMentorThreadMessages)
          .innerJoin(aiMentorThreads, eq(aiMentorThreads.id, aiMentorThreadMessages.threadId))
          .where(
            and(
              eq(aiMentorThreads.userId, f.user.id),
              eq(aiMentorThreadMessages.role, "assistant"),
            ),
          );
        expect(messages).toHaveLength(0);
      });
    } finally {
      release();
      await opening;
      prompt.mockRestore();
      provider.mockRestore();
    }
  });

  it("retakes an AI lesson only in the active repetition", async () => {
    const f = await mentorFixture(true);
    const info = await inTenant(() =>
      repetitionService.repeat(f.course.id, f.user.id, f.current.id),
    );
    const repeat = info.repetition!;
    const repeatThread = await inTenant(() =>
      courseLearningContext.run({ learningStateId: repeat.id }, async () => {
        const thread = await app.get(AiRepository).createThread({
          aiMentorLessonId: f.thread.aiMentorLessonId,
          userId: f.user.id,
          userLanguage: SUPPORTED_LANGUAGES.EN,
          status: "active",
        });
        await db.insert(studentLessonProgress).values({
          studentId: f.user.id,
          lessonId: f.lesson.id,
          chapterId: f.chapter.id,
          learningStateId: repeat.id,
          isStarted: true,
        });
        return thread;
      }),
    );
    await request(app.getHttpServer())
      .post(`/api/ai/retake/${f.lesson.id}`)
      .set("Cookie", await cookieFor(f.user, app))
      .set("x-course-learning-state-id", repeat.id)
      .expect(201);
    await inTenant(async () => {
      const progress = await db
        .select()
        .from(studentLessonProgress)
        .where(eq(studentLessonProgress.studentId, f.user.id));
      expect(progress).toHaveLength(1);
      expect(progress[0].learningStateId).toBe(f.current.id);
      expect(progress[0].completedAt).not.toBeNull();
      const threads = await db
        .select()
        .from(aiMentorThreads)
        .where(eq(aiMentorThreads.userId, f.user.id));
      expect(threads.find((thread) => thread.id === f.thread.id)?.status).toBe("active");
      expect(threads.find((thread) => thread.id === repeatThread.id)?.status).toBe("archived");
    });
  });

  it("waits for AI outside a transaction and commits grading with course completion", async () => {
    const f = await mentorFixture();
    const provider = jest
      .spyOn(app.get(AiRuntimeService), "judgeMentor")
      .mockImplementation(async () => {
        expect(dbAls.getStore()?.trx).toBeUndefined();
        return judgeResult;
      });
    try {
      const result = await request(app.getHttpServer())
        .post(`/api/ai/judge/${f.thread.id}`)
        .set("Cookie", await cookieFor(f.user, app))
        .set("x-course-learning-state-id", f.current.id)
        .expect(201);
      expect(result.body.data.passed).toBe(true);
      expect(provider).toHaveBeenCalledTimes(1);
      await inTenant(async () => {
        const [thread] = await db
          .select()
          .from(aiMentorThreads)
          .where(eq(aiMentorThreads.id, f.thread.id));
        expect(thread.status).toBe("completed");
        expect(
          (await repetitionService.getInfo(f.course.id, f.user.id)).current?.completedAt,
        ).not.toBeNull();
      });
    } finally {
      provider.mockRestore();
    }
  });

  it("rejects AI grading if repetition starts while waiting for the provider", async () => {
    const f = await mentorFixture(true);
    let started!: () => void;
    let release!: () => void;
    const evaluating = new Promise<void>((resolve) => {
      started = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const provider = jest
      .spyOn(app.get(AiRuntimeService), "judgeMentor")
      .mockImplementation(async () => {
        started();
        await pending;
        return judgeResult;
      });
    const cookie = await cookieFor(f.user, app);
    const grading = request(app.getHttpServer())
      .post(`/api/ai/judge/${f.thread.id}`)
      .set("Cookie", cookie)
      .set("x-course-learning-state-id", f.current.id)
      .then((response) => response);
    try {
      await evaluating;
      await inTenant(() => repetitionService.repeat(f.course.id, f.user.id, f.current.id));
      release();
      expect((await grading).status).toBe(409);
      await inTenant(async () => {
        const [thread] = await db
          .select()
          .from(aiMentorThreads)
          .where(eq(aiMentorThreads.id, f.thread.id));
        expect(thread.status).toBe("active");
        expect(
          await db
            .select()
            .from(aiMentorJudgements)
            .where(eq(aiMentorJudgements.threadId, f.thread.id)),
        ).toHaveLength(0);
      });
    } finally {
      release();
      await grading;
      provider.mockRestore();
    }
  });

  it("rolls back AI grading when lesson completion fails", async () => {
    const f = await mentorFixture();
    const provider = jest
      .spyOn(app.get(AiRuntimeService), "judgeMentor")
      .mockResolvedValue(judgeResult);
    const completion = jest
      .spyOn(app.get(StudentLessonProgressService), "markLessonAsCompleted")
      .mockRejectedValueOnce(new Error("Completion failed"));
    try {
      await request(app.getHttpServer())
        .post(`/api/ai/judge/${f.thread.id}`)
        .set("Cookie", await cookieFor(f.user, app))
        .set("x-course-learning-state-id", f.current.id)
        .expect(500);
      await inTenant(async () => {
        const [thread] = await db
          .select()
          .from(aiMentorThreads)
          .where(eq(aiMentorThreads.id, f.thread.id));
        expect(thread.status).toBe("active");
        expect(
          await db
            .select()
            .from(aiMentorJudgements)
            .where(eq(aiMentorJudgements.threadId, f.thread.id)),
        ).toHaveLength(0);
      });
    } finally {
      provider.mockRestore();
      completion.mockRestore();
    }
  });

  it("reads learner summaries with a fixed query count as the page grows", async () => {
    const f = await fixture();
    await inTenant(async () => {
      await db.update(users).set({ avatarReference: null }).where(eq(users.id, f.user.id));
      const info = await repetitionService.repeat(f.course.id, f.user.id, f.current.id);
      await db.insert(studentLessonProgress).values({
        studentId: f.user.id,
        lessonId: f.lesson.id,
        chapterId: f.chapter.id,
        learningStateId: info.repetition!.id,
        completedAt: new Date().toISOString(),
      });
      const viewer = {
        userId: f.user.id,
        tenantId: f.user.tenantId,
        permissions: [PERMISSIONS.COURSE_STATISTICS],
      } as CurrentUserType;
      const read = () =>
        app
          .get(CourseService)
          .getStudentsProgress(
            { courseId: f.course.id, language: SUPPORTED_LANGUAGES.EN, perPage: 100, groupId: "" },
            viewer,
          );
      const selects = jest.spyOn(db, "select");
      let initialQueryCount: number;
      try {
        const first = await read();
        expect(first.data[0]).toMatchObject({
          completedLessonsCount: 1,
          repetitionCompletedLessonsCount: 1,
        });
        expect(first.data[0].completedAt).not.toBeNull();
        initialQueryCount = selects.mock.calls.length;
      } finally {
        selects.mockRestore();
      }
      const additional = await createUserFactory(db).createList(4, { avatarReference: null });
      await db
        .insert(studentCourses)
        .values(additional.map((user) => ({ courseId: f.course.id, studentId: user.id })));
      const expandedSelects = jest.spyOn(db, "select");
      try {
        const expanded = await read();
        expect(expanded.data).toHaveLength(5);
        expect(
          expanded.data.filter((row) => row.repetitionCompletedLessonsCount === null),
        ).toHaveLength(4);
        expect(expandedSelects.mock.calls.length).toBe(initialQueryCount!);
      } finally {
        expandedSelects.mockRestore();
      }
    });
  });

  it("uses the active chapter state in next-lesson statistics", async () => {
    const f = await fixture();
    await inTenant(async () => {
      await repetitionService.repeat(f.course.id, f.user.id, f.current.id);
      const next = await app
        .get(StatisticsRepository)
        .getNextLessonForStudent(f.user.id, SUPPORTED_LANGUAGES.EN);
      expect(next).toMatchObject({
        courseId: f.course.id,
        chapterProgress: "not_started",
        completedLessonCount: 0,
      });
    });
  });

  it.each([LIVE_TRAINING_DELIVERY_TYPES.OFFLINE, LIVE_TRAINING_DELIVERY_TYPES.ONLINE])(
    "rejects stale %s live completion when repetition has started",
    async (deliveryType) => {
      const f = await fixture();
      await inTenant(async () => {
        const info = await repetitionService.repeat(f.course.id, f.user.id, f.current.id);
        const repository = app.get(LiveTrainingSessionsRepository);
        const method =
          deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE
            ? "getOfflineLiveLessonCompletionRows"
            : "getOnlineLiveLessonCompletionRows";
        const rows = jest.spyOn(repository, method);
        try {
          for (const learningStateId of [f.current.id, info.repetition!.id]) {
            rows.mockResolvedValueOnce([
              {
                lessonId: f.lesson.id,
                studentId: f.user.id,
                courseId: f.course.id,
                learningStateId,
                language: SUPPORTED_LANGUAGES.EN,
              },
            ]);
            await app.get(LiveTrainingSessionsService)["markLinkedLiveLessonsCompleted"]({
              liveTrainingId: f.course.id,
              deliveryType,
              completedAt: "2020-01-01T12:00:00.000Z",
              currentUser: {
                tenantId: f.user.tenantId,
                userId: f.user.id,
                permissions: [PERMISSIONS.LEARNING_PROGRESS_UPDATE],
              } as CurrentUserType,
            });
            const after = await repetitionService.getInfo(f.course.id, f.user.id);
            expect(after.current?.id).toBe(f.current.id);
            expect(after.repetition?.id).toBe(info.repetition!.id);
          }
          rows.mockResolvedValueOnce([
            {
              lessonId: f.lesson.id,
              studentId: f.user.id,
              courseId: f.course.id,
              learningStateId: info.repetition!.id,
              language: SUPPORTED_LANGUAGES.EN,
            },
          ]);
          await app.get(LiveTrainingSessionsService)["markLinkedLiveLessonsCompleted"]({
            liveTrainingId: f.course.id,
            deliveryType,
            completedAt: new Date(Date.now() + 1000).toISOString(),
            currentUser: {
              tenantId: f.user.tenantId,
              userId: f.user.id,
              permissions: [PERMISSIONS.LEARNING_PROGRESS_UPDATE],
            } as CurrentUserType,
          });
          const completed = await repetitionService.getInfo(f.course.id, f.user.id);
          expect(completed.current?.id).toBe(info.repetition!.id);
          expect(completed.repetition).toBeNull();
        } finally {
          rows.mockRestore();
        }
      });
    },
  );

  it("requires opt-in and completion", async () => {
    for (const [enabled, completed] of [
      [false, true],
      [true, false],
    ]) {
      const f = await fixture(enabled, completed);
      await expect(
        inTenant(() => repetitionService.repeat(f.course.id, f.user.id, f.current.id)),
      ).rejects.toThrow();
      const info = await inTenant(() => repetitionService.getInfo(f.course.id, f.user.id));
      expect(info.repetition).toBeNull();
    }
  });

  it("backfills existing freemium progress without creating an enrollment or losing completion", async () => {
    const f = await fixture(false, false);
    const completedAt = "2026-01-01T12:00:00.000Z";
    const migration = await readFile(
      resolve(__dirname, "../../storage/migrations/0222_course_repetition_backfill.sql"),
      "utf8",
    );
    await inTenant(async () => {
      await db
        .update(studentLessonProgress)
        .set({ learningStateId: null, completedAt })
        .where(eq(studentLessonProgress.studentId, f.user.id));
      await db
        .update(studentChapterProgress)
        .set({
          learningStateId: null,
          completedAt,
          completedLessonCount: 1,
          completedAsFreemium: true,
        })
        .where(eq(studentChapterProgress.studentId, f.user.id));
      await db.delete(courseLearningStates).where(eq(courseLearningStates.id, f.current.id));
      await db.delete(studentCourses).where(eq(studentCourses.studentId, f.user.id));
      await db.transaction(async (tx) => {
        for (const statement of migration.split("--> statement-breakpoint")) {
          if (/^\s*(INSERT|UPDATE)\b/.test(statement)) await tx.execute(sql.raw(statement));
        }
      });
      const info = await repetitionService.getInfo(f.course.id, f.user.id);
      expect(info.current?.id).toBeTruthy();
      expect(info.repetition).toBeNull();
      const [lesson] = await db
        .select()
        .from(studentLessonProgress)
        .where(eq(studentLessonProgress.studentId, f.user.id));
      const [chapter] = await db
        .select()
        .from(studentChapterProgress)
        .where(eq(studentChapterProgress.studentId, f.user.id));
      expect(lesson.learningStateId).toBe(info.current!.id);
      expect(new Date(lesson.completedAt!).toISOString()).toBe(completedAt);
      expect(chapter.learningStateId).toBe(info.current!.id);
      expect(chapter.completedLessonCount).toBe(1);
      expect(chapter.completedAsFreemium).toBe(true);
      expect(
        await db.select().from(studentCourses).where(eq(studentCourses.studentId, f.user.id)),
      ).toHaveLength(0);
    });
  });

  it("reconciles concurrent starts and keeps accepted results while the repeat is empty", async () => {
    const f = await fixture();
    const starts = await Promise.all(
      Array.from({ length: 3 }, () =>
        inTenant(() => repetitionService.repeat(f.course.id, f.user.id, f.current.id)),
      ),
    );
    expect(new Set(starts.map((info) => info.repetition?.id)).size).toBe(1);
    await inTenant(async () => {
      expect(
        await db
          .select()
          .from(studentLessonProgress)
          .where(
            and(
              eq(studentLessonProgress.studentId, f.user.id),
              activeLearningState(studentLessonProgress.learningStateId),
            ),
          ),
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(studentLessonProgress)
          .where(
            and(
              eq(studentLessonProgress.studentId, f.user.id),
              currentLearningState(studentLessonProgress.learningStateId),
            ),
          ),
      ).toHaveLength(1);
      const [enrollment] = await db
        .select()
        .from(studentCourses)
        .where(eq(studentCourses.studentId, f.user.id));
      expect(enrollment.completedAt).toBeTruthy();
      expect(
        await db
          .select()
          .from(courseLearningStates)
          .where(eq(courseLearningStates.studentId, f.user.id)),
      ).toHaveLength(2);
    });
  });

  it("rejects stale writes and promotes a completed repetition even after opt-out", async () => {
    const f = await fixture();
    const info = await inTenant(() =>
      repetitionService.repeat(f.course.id, f.user.id, f.current.id),
    );
    const cookie = await cookieFor(f.user, app);
    const endpoint = `/api/studentLessonProgress?id=${f.lesson.id}&language=en`;
    await request(app.getHttpServer())
      .post(endpoint)
      .set("Cookie", cookie)
      .set("x-course-learning-state-id", f.current.id)
      .expect(409);
    await request(app.getHttpServer()).post(endpoint).set("Cookie", cookie).expect(409);
    await inTenant(() =>
      db
        .update(courses)
        .set({ settings: { ...f.course.settings, repetitionEnabled: false } })
        .where(eq(courses.id, f.course.id)),
    );
    await request(app.getHttpServer())
      .post(endpoint)
      .set("Cookie", cookie)
      .set("x-course-learning-state-id", info.repetition!.id)
      .expect(201);
    await inTenant(async () => {
      const after = await repetitionService.getInfo(f.course.id, f.user.id);
      expect(after.repetition).toBeNull();
      expect(after.current?.id).toBe(info.repetition?.id);
      expect(after.current?.completedAt).toBeTruthy();
      const progress = await db
        .select()
        .from(studentLessonProgress)
        .where(eq(studentLessonProgress.studentId, f.user.id));
      expect(progress).toHaveLength(1);
      expect(progress[0].learningStateId).toBe(after.current?.id);
      const [stats] = await db
        .select()
        .from(coursesSummaryStats)
        .where(eq(coursesSummaryStats.courseId, f.course.id));
      expect(stats.paidPurchasedCount).toBe(0);
      await expect(
        repetitionService.repeat(f.course.id, f.user.id, after.current!.id),
      ).rejects.toThrow();
      await db
        .update(courses)
        .set({ settings: { ...f.course.settings, repetitionEnabled: true } })
        .where(eq(courses.id, f.course.id));
      expect(
        (await repetitionService.repeat(f.course.id, f.user.id, after.current!.id)).repetition,
      ).not.toBeNull();
    });
  });

  it("does not allow repeating another learner's state", async () => {
    const f = await fixture();
    const other = await fixture();
    await expect(
      inTenant(() => repetitionService.repeat(f.course.id, other.user.id, f.current.id)),
    ).rejects.toThrow();
  });

  it("shows accepted results and repetition progress only within the manager's learner scope", async () => {
    const f = await fixture();
    const outsider = await fixture();
    const manager = await inTenant(async () => {
      const manager = await createUserFactory(db)
        .withCredentials({ password: "password123" })
        .withUserSettings(db)
        .create();
      await assignSystemRoleToUserInTests(
        db,
        manager.id,
        manager.tenantId,
        SYSTEM_ROLE_SLUGS.GROUP_MANAGER,
      );
      const group = await createGroupFactory(db).withMembers([f.user.id]).create();
      await db.insert(groupManagerGroups).values({ groupId: group.id, managerUserId: manager.id });
      await db
        .insert(studentCourses)
        .values({ courseId: f.course.id, studentId: outsider.user.id });
      await repetitionService.repeat(f.course.id, f.user.id, f.current.id);
      return manager;
    });
    const managerCookie = await cookieFor(manager, app);
    const learnerCookie = await cookieFor(f.user, app);
    const access = await request(app.getHttpServer())
      .get("/api/auth/current-user")
      .set("Cookie", managerCookie)
      .expect(200);
    expect(access.body.data.permissions).toContain(PERMISSIONS.MANAGED_GROUP_RESULTS_READ);
    const accepted = await request(app.getHttpServer())
      .get(`/api/lesson/${f.lesson.id}?language=en&studentId=${f.user.id}`)
      .set("Cookie", managerCookie);
    expect({ status: accepted.status, message: accepted.body.message }).toEqual({
      status: 200,
      message: undefined,
    });
    expect(accepted.body.data.lessonCompleted).toBe(true);
    expect(accepted.body.data.learningStateId).toBe(f.current.id);
    const active = await request(app.getHttpServer())
      .get(`/api/lesson/${f.lesson.id}?language=en`)
      .set("Cookie", learnerCookie)
      .expect(200);
    expect(active.body.data.lessonCompleted).toBe(false);
    expect(active.body.data.learningStateId).not.toBe(f.current.id);
    await request(app.getHttpServer())
      .get(`/api/lesson/${f.lesson.id}?language=en&studentId=${outsider.user.id}`)
      .set("Cookie", managerCookie)
      .expect(404);
    const summary = await request(app.getHttpServer())
      .get(`/api/course/${f.course.id}/statistics/students-progress?language=en`)
      .set("Cookie", managerCookie)
      .expect(200);
    expect(summary.body.data).toHaveLength(1);
    expect(summary.body.data[0]).toMatchObject({
      studentId: f.user.id,
      completedLessonsCount: 1,
      repetitionCompletedLessonsCount: 0,
    });
  });

  it("starts fresh quiz, video, SCORM and AI state, resumes it, and removes old runtime records on promotion", async () => {
    const f = await fixture();
    const cookie = await cookieFor(f.user, app);
    await inTenant(async () => {
      const quiz = app.get(QuizRuntimeRepository);
      const scorm = app.get(ScormRepository);
      const video = app.get(LessonVideoProgressRepository);
      const ai = app.get(AiRepository);
      const [assessment] = await db
        .insert(assessments)
        .values({ lessonId: f.lesson.id, passingScorePercentage: "50" })
        .returning();
      const quizValues = {
        assessmentId: assessment.id,
        learnerId: f.user.id,
        language: SUPPORTED_LANGUAGES.EN,
        attemptNumber: 1,
        availablePoints: "10",
        awardedPoints: "10",
        scorePercentage: "100",
        submittedAt: new Date().toISOString(),
      };
      await courseLearningContext.run({ learningStateId: f.current.id }, () =>
        db.transaction((tx) => quiz.insertAttempt(quizValues, tx)),
      );
      const resource = await createResourceFactory(db)
        .linkedTo({ entityId: f.lesson.id, entityType: "lesson" })
        .create({ contentType: "video/mp4" });
      const [link] = await db
        .select()
        .from(resourceEntity)
        .where(eq(resourceEntity.resourceId, resource.id));
      const videoParams = {
        studentId: f.user.id,
        lessonId: f.lesson.id,
        resourceEntityId: link.id,
        durationSeconds: 30,
        bucketSizeSeconds: 1,
      };
      await video.ensureProgressRow(videoParams);
      await video.mergeWatchedRanges({
        ...videoParams,
        ranges: [[0, 10]],
        activeWatchSecondsDelta: 10,
      });
      const [pkg] = await db
        .insert(scormPackages)
        .values({
          entityType: "lesson",
          entityId: f.lesson.id,
          standard: SCORM_STANDARD.SCORM_1_2,
          originalFileReference: "test.zip",
          extractedFilesReference: "test",
          manifestEntryPoint: "index.html",
        })
        .returning();
      const [sco] = await db
        .insert(scormScos)
        .values({
          packageId: pkg.id,
          lessonId: f.lesson.id,
          identifier: "sco",
          title: "SCO",
          launchPath: "index.html",
          displayOrder: 1,
        })
        .returning();
      const scormParams = {
        studentId: f.user.id,
        courseId: f.course.id,
        lessonId: f.lesson.id,
        packageId: pkg.id,
        scoId: sco.id,
      };
      const oldScorm = await scorm.findOrCreateAttempt(scormParams);
      const [mentor] = await db
        .insert(aiMentorLessons)
        .values({ lessonId: f.lesson.id })
        .returning();
      const threadValues = {
        aiMentorLessonId: mentor.id,
        userId: f.user.id,
        userLanguage: SUPPORTED_LANGUAGES.EN,
        status: "active" as const,
      };
      const oldThread = await ai.createThread(threadValues);

      const info = await repetitionService.repeat(f.course.id, f.user.id, f.current.id);
      await request(app.getHttpServer())
        .post(`/api/ai/judge/${oldThread.id}`)
        .set("Cookie", cookie)
        .set("x-course-learning-state-id", info.repetition!.id)
        .expect(409);
      await request(app.getHttpServer())
        .post("/api/scorm/runtime/commit")
        .set("Cookie", cookie)
        .set("x-course-learning-state-id", info.repetition!.id)
        .send({ attemptId: oldScorm.attempt.id, data: {} })
        .expect(409);
      expect(await quiz.findLatestAttempt(assessment.id, f.user.id)).toBeNull();
      expect(
        await video.getProgressForResourceIds({ ...videoParams, resourceEntityIds: [link.id] }),
      ).toEqual([]);
      expect(await ai.findThread([eq(aiMentorThreads.id, oldThread.id)])).toBeUndefined();
      const freshVideo = await video.ensureProgressRow(videoParams);
      expect(freshVideo.coveragePercent).toBe(0);
      const freshScorm = await scorm.findOrCreateAttempt(scormParams);
      expect(freshScorm.attempt.id).not.toBe(oldScorm.attempt.id);
      expect((await scorm.findOrCreateAttempt(scormParams)).attempt.id).toBe(freshScorm.attempt.id);
      const freshThread = await ai.createThread(threadValues);
      expect(freshThread.learningStateId).toBe(info.repetition?.id);
      await courseLearningContext.run({ learningStateId: info.repetition!.id }, () =>
        db.transaction((tx) => quiz.insertAttempt({ ...quizValues, scorePercentage: "80" }, tx)),
      );
      expect((await quiz.findLatestAttempt(assessment.id, f.user.id))?.scorePercentage).toBe(
        "80.00",
      );

      await db.transaction((tx) => repetitionService.complete(f.course.id, f.user.id, 1, tx));
      for (const table of [
        assessmentAttempts,
        lessonVideoProgress,
        scormAttempts,
        aiMentorThreads,
      ]) {
        expect(
          await db
            .select({ id: table.id })
            .from(table)
            .where(eq(table.learningStateId, f.current.id)),
        ).toHaveLength(0);
        expect(
          await db
            .select({ id: table.id })
            .from(table)
            .where(eq(table.learningStateId, info.repetition!.id)),
        ).toHaveLength(1);
      }
    });
  });

  it("replaces a certificate only after a new qualifying completion", async () => {
    const f = await fixture();
    const service = app.get(CertificatesService);
    const oldCertificate = await inTenant(async () => {
      await db.update(courses).set({ hasCertificate: true }).where(eq(courses.id, f.course.id));
      return service.createCertificate(f.user.id, f.course.id);
    });
    const info = await inTenant(() =>
      repetitionService.repeat(f.course.id, f.user.id, f.current.id),
    );
    await inTenant(async () => {
      const [old] = await db
        .select()
        .from(certificates)
        .where(eq(certificates.id, oldCertificate.id));
      expect(old.status).toBe("active");
    });
    const cookie = await cookieFor(f.user, app);
    await request(app.getHttpServer())
      .post(`/api/studentLessonProgress?id=${f.lesson.id}&language=en`)
      .set("Cookie", cookie)
      .set("x-course-learning-state-id", info.repetition!.id)
      .expect(201);
    await inTenant(async () => {
      const rows = await db.select().from(certificates).where(eq(certificates.userId, f.user.id));
      expect(rows).toHaveLength(2);
      expect(rows.find((row) => row.id === oldCertificate.id)?.archiveReason).toBe("replaced");
      expect(rows.filter((row) => row.status === "active")).toHaveLength(1);
      expect(rows.find((row) => row.status === "active")?.issuedAt).not.toBe(
        oldCertificate.issuedAt,
      );
    });
  });

  it.each(["expiry", "validity"])(
    "keeps earned completion without any repetition after opt-out and certificate %s",
    async (operation) => {
      const f = await fixture();
      await inTenant(async () => {
        const service = app.get(CertificatesService);
        await db.update(courses).set({ hasCertificate: true }).where(eq(courses.id, f.course.id));
        const certificate = await service.createCertificate(f.user.id, f.course.id);
        await db
          .update(courses)
          .set({ settings: { ...f.course.settings, repetitionEnabled: false } })
          .where(eq(courses.id, f.course.id));
        await db
          .update(certificates)
          .set({ issuedAt: "2026-01-01T12:00:00.000Z", expiresAt: "2026-01-02T12:00:00.000Z" })
          .where(eq(certificates.id, certificate.id));
        if (operation === "expiry") {
          await service.expireCertificates();
        } else {
          await service.applyValidityToExistingCertificates(
            f.course.id,
            {
              type: CERTIFICATE_VALIDITY_TYPES.PERIOD,
              value: 1,
              unit: CERTIFICATE_VALIDITY_UNITS.DAYS,
            },
            {
              userId: f.user.id,
              email: f.user.email,
              tenantId: f.user.tenantId,
              permissions: [],
              roleSlugs: [],
            },
          );
        }
        const [expired] = await db
          .select()
          .from(certificates)
          .where(eq(certificates.id, certificate.id));
        expect(expired.status).toBe("archived");
        expect(expired.archiveReason).toBe("expired");
        const info = await repetitionService.getInfo(f.course.id, f.user.id);
        expect(info.current?.id).toBe(f.current.id);
        expect(info.current?.completedAt).toBe(f.current.completedAt);
        expect(info.repetition).toBeNull();
        const [enrollment] = await db
          .select()
          .from(studentCourses)
          .where(eq(studentCourses.studentId, f.user.id));
        expect(enrollment.progress).toBe("completed");
        expect(enrollment.completedAt).toBe(f.current.completedAt);
        const [progress] = await db
          .select()
          .from(studentLessonProgress)
          .where(eq(studentLessonProgress.studentId, f.user.id));
        expect(progress.completedAt).toBe(f.current.completedAt);
      });
    },
  );

  it("keeps earned and unearned results unchanged when repetition is disabled from the start", async () => {
    const earned = await fixture(false, true);
    const unearned = await fixture(false, false);
    await inTenant(async () => {
      const service = app.get(CertificatesService);
      await db
        .update(courses)
        .set({ hasCertificate: true })
        .where(eq(courses.id, earned.course.id));
      const certificate = await service.createCertificate(earned.user.id, earned.course.id);
      await db
        .update(certificates)
        .set({ expiresAt: "2026-01-02T12:00:00.000Z" })
        .where(eq(certificates.id, certificate.id));
      await service.expireCertificates();
      expect(
        (await repetitionService.getInfo(earned.course.id, earned.user.id)).current?.completedAt,
      ).toBe(earned.current.completedAt);
      expect(
        (await repetitionService.getInfo(unearned.course.id, unearned.user.id)).current
          ?.completedAt,
      ).toBeNull();
      const [enrollment] = await db
        .select()
        .from(studentCourses)
        .where(eq(studentCourses.studentId, unearned.user.id));
      expect(enrollment.progress).toBe("in_progress");
      expect(enrollment.completedAt).toBeNull();
      expect(
        await db.select().from(certificates).where(eq(certificates.userId, unearned.user.id)),
      ).toHaveLength(0);
    });
  });

  it("keeps completion and repetition when a certificate expires after opt-out, and honors manual reset", async () => {
    const f = await fixture();
    await inTenant(async () => {
      const service = app.get(CertificatesService);
      await db.update(courses).set({ hasCertificate: true }).where(eq(courses.id, f.course.id));
      const certificate = await service.createCertificate(f.user.id, f.course.id);
      await repetitionService.repeat(f.course.id, f.user.id, f.current.id);
      await db
        .update(courses)
        .set({ settings: { ...f.course.settings, repetitionEnabled: false } })
        .where(eq(courses.id, f.course.id));
      await db
        .update(certificates)
        .set({ expiresAt: "2026-01-02T12:00:00.000Z" })
        .where(eq(certificates.id, certificate.id));
      await service.expireCertificates();
      expect((await repetitionService.getInfo(f.course.id, f.user.id)).repetition).not.toBeNull();
      const [enrollment] = await db
        .select()
        .from(studentCourses)
        .where(eq(studentCourses.studentId, f.user.id));
      expect(enrollment.completedAt).toBeTruthy();
      await db
        .update(certificates)
        .set({ status: "active", expiresAt: null })
        .where(eq(certificates.id, certificate.id));
      await service.resetCourseCertificates(
        f.course.id,
        { scope: "users", userIds: [f.user.id], sendEmail: false },
        {
          userId: f.user.id,
          email: f.user.email,
          tenantId: f.user.tenantId,
          permissions: [PERMISSIONS.COURSE_ENROLLMENT],
          roleSlugs: [],
        },
      );
      expect((await repetitionService.getInfo(f.course.id, f.user.id)).repetition).toBeNull();
      const [reset] = await db
        .select()
        .from(studentCourses)
        .where(eq(studentCourses.studentId, f.user.id));
      expect(reset.completedAt).toBeNull();
      expect(reset.progress).toBe("not_started");
    });
  });

  it("retains the accepted result and certificate when new issuance fails", async () => {
    const f = await fixture();
    const service = app.get(CertificatesService);
    const old = await inTenant(async () => {
      await db.update(courses).set({ hasCertificate: true }).where(eq(courses.id, f.course.id));
      return service.createCertificate(f.user.id, f.course.id);
    });
    const info = await inTenant(() =>
      repetitionService.repeat(f.course.id, f.user.id, f.current.id),
    );
    const failedIssuance = jest
      .spyOn(service, "createCertificate")
      .mockRejectedValueOnce(new Error("Certificate issuance failed"));
    try {
      const cookie = await cookieFor(f.user, app);
      await request(app.getHttpServer())
        .post(`/api/studentLessonProgress?id=${f.lesson.id}&language=en`)
        .set("Cookie", cookie)
        .set("x-course-learning-state-id", info.repetition!.id)
        .expect(500);
      await inTenant(async () => {
        const after = await repetitionService.getInfo(f.course.id, f.user.id);
        expect(after.current?.id).toBe(f.current.id);
        expect(after.repetition?.id).toBe(info.repetition?.id);
        const [certificate] = await db
          .select()
          .from(certificates)
          .where(eq(certificates.id, old.id));
        expect(certificate.status).toBe("active");
      });
    } finally {
      failedIssuance.mockRestore();
    }
  });
});
