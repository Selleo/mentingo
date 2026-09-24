import { SUPPORTED_LANGUAGES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";

import { AI_JUDGE_CRITERION_STATUS } from "src/ai/judge-configuration/judge-configuration.types";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { AiPracticeService } from "src/ai/services/ai-practice.service";
import { AiService } from "src/ai/services/ai.service";
import { JudgeService } from "src/ai/services/judge.service";
import { THREAD_STATUS } from "src/ai/utils/ai.type";
import { buildJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { LessonRepository } from "src/lesson/repositories/lesson.repository";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  aiJudgeConfigurations,
  aiJudgeCriteria,
  aiMentorConfigurations,
  aiMentorLessons,
  aiMentorPracticeSessions,
  aiMentorThreads,
  aiMentorThreadMessages,
  aiMentorJudgements,
  chapters,
  courses,
  lessons,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import { createAiMentorLessonFactory } from "./createAiMentorLesson";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

describe("AiController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let aiRepository: AiRepository;
  let lessonRepository: LessonRepository;

  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let aiMentorLessonFactory: ReturnType<typeof createAiMentorLessonFactory>;

  const password = "password123";

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createE2ETest();
    app = testApp;

    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    aiRepository = moduleFixture.get(AiRepository);
    lessonRepository = moduleFixture.get(LessonRepository);

    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    aiMentorLessonFactory = createAiMentorLessonFactory(db);
  }, 30000);

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
    await app.close();
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
  });

  it("preserves completed practice history across concurrent grading and replay", async () => {
    const owner = await userFactory.create();
    const [session] = await db
      .insert(aiMentorPracticeSessions)
      .values({
        userId: owner.id,
        practiceDate: "2026-09-10",
        language: "en",
        scenario: "Replay test",
        status: "ready",
      })
      .returning();
    const [previous] = await db
      .insert(aiMentorThreads)
      .values({
        practiceSessionId: session.id,
        userId: owner.id,
        status: THREAD_STATUS.ACTIVE,
      })
      .returning();
    const [message] = await db
      .insert(aiMentorThreadMessages)
      .values({
        threadId: previous.id,
        role: "user",
        content: "Original answer",
        archived: true,
      })
      .returning();
    const [configuration] = await db
      .insert(aiJudgeConfigurations)
      .values({
        practiceSessionId: session.id,
        taskGoal: { en: "Goal" },
        passingThresholdPercent: 70,
      })
      .returning();
    const judgeService = app.get(JudgeService);
    const rubric = {
      configurationId: configuration.id,
      taskGoal: "Goal",
      passingThresholdPercent: 70,
      criteria: [],
      blockingErrors: [],
    };
    const result = {
      minScore: 1,
      score: 1,
      maxScore: 1,
      percentage: 100,
      passed: true,
      criteria: [],
      blockingErrors: [],
    };
    const lateResult = { ...result, score: 0, percentage: 0, passed: false };
    const persist = (value = result) =>
      judgeService["persistJudgement"](previous.id, "en", rubric, value);

    // A failed write must also roll back the Active -> Completed claim.
    await expect(
      judgeService["persistJudgement"](
        previous.id,
        "en",
        { ...rubric, configurationId: owner.id },
        result,
      ),
    ).rejects.toThrow();
    expect((await aiRepository.findPracticeSessionById(session.id)).threadStatus).toBe(
      THREAD_STATUS.ACTIVE,
    );
    const grading = await Promise.allSettled([persist(), persist()]);
    expect(grading.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(grading.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    await expect(persist(lateResult)).rejects.toThrow("common.error.threadMustBeActive");
    const [judgement] = await db
      .select()
      .from(aiMentorJudgements)
      .where(eq(aiMentorJudgements.threadId, previous.id));
    expect(judgement.earnedPoints).toBe(1);
    const prepareReplay = jest
      .spyOn(app.get(AiService), "preparePracticeReplay")
      .mockResolvedValue([{ role: "assistant", content: "New welcome", tokenCount: 2 }]);
    const practiceService = app.get(AiPracticeService);
    const viewer = { userId: owner.id, tenantId: owner.tenantId, permissions: [] };
    const outcomes = await Promise.allSettled([
      practiceService.replay(session.id, viewer as never),
      practiceService.replay(session.id, viewer as never),
    ]);
    prepareReplay.mockRestore();
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rejected = outcomes.find((result) => result.status === "rejected");
    if (rejected?.status === "rejected") expect(rejected.reason.getStatus()).toBe(409);
    const threads = await db
      .select()
      .from(aiMentorThreads)
      .where(eq(aiMentorThreads.practiceSessionId, session.id));
    expect(threads).toHaveLength(2);
    expect(threads.find((thread) => thread.id === previous.id)?.status).toBe(
      THREAD_STATUS.ARCHIVED,
    );
    expect(
      await db
        .select()
        .from(aiMentorThreadMessages)
        .where(eq(aiMentorThreadMessages.id, message.id)),
    ).toHaveLength(1);
    expect(
      await db.select().from(aiMentorJudgements).where(eq(aiMentorJudgements.id, judgement.id)),
    ).toHaveLength(1);
    const current = await aiRepository.findPracticeSessionById(session.id);
    expect(current.threadId).not.toBe(previous.id);
    expect(current.threadStatus).toBe(THREAD_STATUS.ACTIVE);
    expect(current.evaluation).toBeNull();
    // Simulate another grading response arriving after this attempt has been replayed.
    await expect(persist(lateResult)).rejects.toThrow("common.error.threadMustBeActive");
    const [historicalJudgement] = await db
      .select()
      .from(aiMentorJudgements)
      .where(eq(aiMentorJudgements.id, judgement.id));
    expect(historicalJudgement).toEqual(judgement);
    await expect(app.get(AiService).isThreadActive(previous.id, owner.id)).rejects.toThrow(
      "common.error.threadMustBeActive",
    );
    await expect(
      app
        .get(JudgeService)
        .runJudge(
          { threadId: previous.id, userId: owner.id },
          { userId: owner.id, permissions: [] },
        ),
    ).rejects.toThrow("common.error.threadMustBeActive");
  });

  describe("AI mentor lesson localization", () => {
    const getCourseIdForAiMentorLesson = async (lessonId: UUIDType) => {
      const [lesson] = await db
        .select({ chapterId: lessons.chapterId })
        .from(lessons)
        .where(eq(lessons.id, lessonId));
      const [chapter] = await db
        .select({ courseId: chapters.courseId })
        .from(chapters)
        .where(eq(chapters.id, lesson.chapterId));

      return chapter.courseId;
    };

    const addPolishAiMentorScenario = async (aiMentorLessonId: UUIDType) => {
      await db
        .update(aiMentorConfigurations)
        .set({
          additionalInstructions: setJsonbField(
            aiMentorConfigurations.additionalInstructions,
            SUPPORTED_LANGUAGES.PL,
            "Polish mentor instructions",
          ),
        })
        .where(eq(aiMentorConfigurations.aiMentorLessonId, aiMentorLessonId));
      await db
        .update(aiMentorLessons)
        .set({
          name: setJsonbField(aiMentorLessons.name, SUPPORTED_LANGUAGES.PL, "Polish mentor"),
        })
        .where(eq(aiMentorLessons.id, aiMentorLessonId));
    };

    it("resolves prompt instructions in the thread language", async () => {
      const threadOwner = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const aiMentorLesson = await aiMentorLessonFactory.create({
        additionalInstructions: "English mentor instructions",
        taskGoal: "English task goal",
      });
      const courseId = await getCourseIdForAiMentorLesson(aiMentorLesson.lessonId);

      await db
        .update(courses)
        .set({
          availableLocales: [
            SUPPORTED_LANGUAGES.EN,
            SUPPORTED_LANGUAGES.PL,
            SUPPORTED_LANGUAGES.DE,
          ],
          baseLanguage: SUPPORTED_LANGUAGES.EN,
        })
        .where(eq(courses.id, courseId));
      await addPolishAiMentorScenario(aiMentorLesson.id);

      const thread = await aiRepository.createThread({
        userId: threadOwner.id,
        aiMentorLessonId: aiMentorLesson.id,
        status: THREAD_STATUS.ACTIVE,
        userLanguage: SUPPORTED_LANGUAGES.PL,
      });

      const polishLesson = await aiRepository.findMentorLessonByThreadId(
        thread.id,
        SUPPORTED_LANGUAGES.PL,
      );
      const fallbackLesson = await aiRepository.findMentorLessonByThreadId(
        thread.id,
        SUPPORTED_LANGUAGES.DE,
      );

      expect(polishLesson.additionalInstructions).toBe("Polish mentor instructions");
      expect(polishLesson.name).toBe("Polish mentor");
      expect(fallbackLesson.additionalInstructions).toBe("English mentor instructions");
      expect(polishLesson.learnerFirstName).toBe(threadOwner.firstName);
    });
  });

  describe("persisted AI Judge results", () => {
    it("returns judgement details without learner progress and restores a blank title snapshot", async () => {
      const courseAuthor = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const aiMentorLesson = await aiMentorLessonFactory.create();
      const [configuration] = await db
        .select({ id: aiJudgeConfigurations.id })
        .from(aiJudgeConfigurations)
        .where(eq(aiJudgeConfigurations.aiMentorLessonId, aiMentorLesson.id));
      const [criterion] = await db
        .insert(aiJudgeCriteria)
        .values({
          configurationId: configuration.id,
          title: buildJsonbField(SUPPORTED_LANGUAGES.EN, "HTML basics"),
          expectedBehavior: buildJsonbField(
            SUPPORTED_LANGUAGES.EN,
            "Demonstrates basic HTML knowledge",
          ),
          maxScore: 2,
        })
        .returning({ id: aiJudgeCriteria.id });
      const thread = await aiRepository.createThread({
        userId: courseAuthor.id,
        aiMentorLessonId: aiMentorLesson.id,
        status: THREAD_STATUS.COMPLETED,
        userLanguage: SUPPORTED_LANGUAGES.EN,
      });
      const judgement = await aiRepository.upsertJudgeJudgement({
        threadId: thread.id,
        configurationId: configuration.id,
        language: SUPPORTED_LANGUAGES.EN,
        earnedPoints: 0,
        maxScore: 2,
        percentage: 0,
        passed: false,
      });

      await aiRepository.insertJudgeCriterionJudgements([
        {
          judgementId: judgement.id,
          criterionId: criterion.id,
          criterionTitle: "",
          awardedPoints: 0,
          maxScoreAtJudgement: 2,
          status: AI_JUDGE_CRITERION_STATUS.NOT_MET,
          learnerSafeFeedback: "No evidence was provided.",
        },
      ]);

      const lesson = await lessonRepository.getLessonDetails(
        aiMentorLesson.lessonId,
        courseAuthor.id,
        SUPPORTED_LANGUAGES.EN,
      );

      expect(lesson.aiMentorDetails).toMatchObject({
        minScore: 0,
        maxScore: 2,
        score: 0,
        percentage: 0,
        passed: false,
        criteria: [
          expect.objectContaining({
            criterionId: criterion.id,
            title: "HTML basics",
          }),
        ],
      });
    });
  });

  describe("GET /api/ai/thread", () => {
    let threadId: UUIDType;
    let threadOwner: UserWithCredentials;

    beforeAll(async () => {
      threadOwner = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });

      const aiMentorLesson = await aiMentorLessonFactory.create();

      const thread = await aiRepository.createThread({
        userId: threadOwner.id,
        aiMentorLessonId: aiMentorLesson.id,
        status: THREAD_STATUS.ACTIVE,
        userLanguage: "en",
      });

      threadId = thread.id;
    });

    it("returns thread when user owns it", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/ai/thread?thread=${threadId}`)
        .set("Cookie", await cookieFor(threadOwner, app))
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(threadId);
    });

    it("returns 401 when not authenticated", async () => {
      await request(app.getHttpServer()).get(`/api/ai/thread?thread=${threadId}`).expect(401);
    });

    it("returns 404 for non-existent thread", async () => {
      const user = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });

      const fakeThreadId = "00000000-0000-0000-0000-000000000000";

      await request(app.getHttpServer())
        .get(`/api/ai/thread?thread=${fakeThreadId}`)
        .set("Cookie", await cookieFor(user, app))
        .expect(404);
    });

    it("returns 403 when accessing another user's thread", async () => {
      const otherUser = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });

      await request(app.getHttpServer())
        .get(`/api/ai/thread?thread=${threadId}`)
        .set("Cookie", await cookieFor(otherUser, app))
        .expect(403);
    });

    it("allows admin to access any thread", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

      const response = await request(app.getHttpServer())
        .get(`/api/ai/thread?thread=${threadId}`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(response.body.data.id).toBe(threadId);
    });
  });

  describe("GET /api/ai/thread/messages", () => {
    let threadId: UUIDType;
    let threadOwner: UserWithCredentials;

    beforeAll(async () => {
      threadOwner = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });

      const aiMentorLesson = await aiMentorLessonFactory.create();

      const thread = await aiRepository.createThread({
        userId: threadOwner.id,
        aiMentorLessonId: aiMentorLesson.id,
        status: THREAD_STATUS.ACTIVE,
        userLanguage: "en",
      });

      threadId = thread.id;

      // Insert a test message
      await aiRepository.insertMessage({
        threadId: thread.id,
        role: "user",
        content: "Test message",
        tokenCount: 2,
      });
    });

    it("returns messages for thread owner", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/ai/thread/messages?thread=${threadId}`)
        .set("Cookie", await cookieFor(threadOwner, app))
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("returns 401 when not authenticated", async () => {
      await request(app.getHttpServer())
        .get(`/api/ai/thread/messages?thread=${threadId}`)
        .expect(401);
    });

    it("returns 403 when accessing another user's thread messages", async () => {
      const otherUser = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });

      await request(app.getHttpServer())
        .get(`/api/ai/thread/messages?thread=${threadId}`)
        .set("Cookie", await cookieFor(otherUser, app))
        .expect(403);
    });
  });
});
