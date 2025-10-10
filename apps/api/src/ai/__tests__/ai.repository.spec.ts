import { eq } from "drizzle-orm";

import { createAiMentorLessonFactory } from "src/ai/__tests__/createAiMentorLesson";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { TokenService } from "src/ai/services/token.service";
import { MESSAGE_ROLE, OPENAI_MODELS, THREAD_STATUS } from "src/ai/utils/ai.type";
import { aiMentorLessons, aiMentorThreads, groups, groupUsers, lessons } from "src/storage/schema";

import { createUnitTest } from "../../../test/create-unit-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { truncateTables } from "../../../test/helpers/test-helpers";

import type { TestContext } from "../../../test/create-unit-test";
import type { CategoryTest } from "../../../test/factory/category.factory";
import type { CourseTest } from "../../../test/factory/course.factory";
import type { AiMentorLessonTest } from "src/ai/__tests__/createAiMentorLesson";
import type { DatabasePg } from "src/common";

describe("AiRepository (unit)", () => {
  let testContext: TestContext;
  let db: DatabasePg;
  let aiRepository: AiRepository;
  let tokenService: TokenService;

  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let aiMentorLessonFactory: ReturnType<typeof createAiMentorLessonFactory>;

  let category: CategoryTest;
  let course: CourseTest;
  let aiMentorLesson: AiMentorLessonTest;

  let thread: Awaited<ReturnType<AiRepository["createThread"]>>;

  beforeAll(async () => {
    testContext = await createUnitTest();
    aiRepository = testContext.module.get(AiRepository);
    tokenService = testContext.module.get(TokenService);

    db = testContext.db;

    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
    aiMentorLessonFactory = createAiMentorLessonFactory(db);

    category = await categoryFactory.create();

    course = await courseFactory.create({
      status: "published",
      thumbnailS3Key: null,
      categoryId: category.id,
    });

    aiMentorLesson = await aiMentorLessonFactory.create();

    thread = await aiRepository.createThread({
      userId: course.authorId,
      aiMentorLessonId: aiMentorLesson.id,
      status: THREAD_STATUS.ACTIVE,
      userLanguage: "en",
    });
  }, 30000);

  afterAll(async () => {
    await truncateTables(db, [
      "ai_mentor_lessons",
      "ai_mentor_threads",
      "ai_mentor_thread_messages",
      "lessons",
      "chapters",
      "courses",
      "users",
    ]);
    await testContext.teardown();
  });

  describe("Create", () => {
    it("should create thread for aiMentorLesson", async () => {
      const thread = await aiRepository.createThread({
        userId: course.authorId,
        aiMentorLessonId: aiMentorLesson.id,
        status: THREAD_STATUS.ACTIVE,
        userLanguage: "en",
      });

      expect(thread).toBeDefined();
    });

    it("should insert message", async () => {
      const content = "Hello World";
      const tokenCount = tokenService.countTokens(OPENAI_MODELS.BASIC, content);

      const threadMessage = await aiRepository.insertMessage({
        threadId: thread.id,
        role: MESSAGE_ROLE.SYSTEM,
        tokenCount,
        content,
      });

      expect(threadMessage).toBeDefined();
    });
  });

  describe("Read", () => {
    it("should find aiMentorLessonId by lessonId", async () => {
      const [lesson] = await db
        .select()
        .from(lessons)
        .innerJoin(aiMentorLessons, eq(aiMentorLessons.lessonId, lessons.id));

      const aiMentorLesson = await aiRepository.findAiMentorLessonIdFromLesson(lesson.lessons.id);

      expect(aiMentorLesson.aiMentorLessonId).toBe(lesson.ai_mentor_lessons.id);
    });

    it("should find thread by threadId", async () => {
      const foundThread = await aiRepository.findThread([eq(aiMentorThreads.id, thread.id)]);

      expect(foundThread).toBeDefined();
    });

    it("should find lessonId by threadId", async () => {
      const lessonId = await aiRepository.findLessonIdByThreadId(thread.id);

      expect(lessonId).toBeDefined();
    });

    it("should find two threads", async () => {
      const threads = await aiRepository.findThreads([
        eq(aiMentorThreads.aiMentorLessonId, aiMentorLesson.id),
      ]);

      expect(threads).toHaveLength(2);
    });

    it("should find aiMentorLesson by threadId", async () => {
      const lesson = await aiRepository.findMentorLessonByThreadId(thread.id);

      expect(lesson.instructions).toBe(aiMentorLesson.aiMentorInstructions);
    });

    it("find groups by threadId", async () => {
      const beforeGroups = await aiRepository.findGroupsByThreadId(thread.id);

      expect(beforeGroups).toHaveLength(0);

      const [group] = await db.insert(groups).values({ name: "Test" }).returning();
      await db.insert(groupUsers).values({ groupId: group.id, userId: course.authorId });

      const afterGroups = await aiRepository.findGroupsByThreadId(thread.id);

      expect(afterGroups).toHaveLength(1);
    });

    it("should find first message by role and threadId", async () => {
      const message = await aiRepository.findFirstMessageByRoleAndThread(
        thread.id,
        MESSAGE_ROLE.SYSTEM,
      );

      expect(message?.content).toBe("Hello World");
    });

    it("should find message history", async () => {
      const content = "Hi";
      const tokenCount = tokenService.countTokens(OPENAI_MODELS.BASIC, content);

      await aiRepository.insertMessage({
        threadId: thread.id,
        role: MESSAGE_ROLE.USER,
        tokenCount,
        content,
      });

      const messages = await aiRepository.findMessageHistory(thread.id);

      expect(messages).toHaveLength(1);
    });

    it("should find token sum for thread", async () => {
      const tokenCount = await aiRepository.getTokenSumForThread(thread.id, false);

      expect(Number(tokenCount)).toBe(1);
    });
  });

  describe("Update", () => {
    it("should archive messages", async () => {
      const archived = await aiRepository.archiveMessages(thread.id);

      expect(archived).toBeDefined();
    });

    it("should update summary", async () => {
      const content = "User said Hi";
      const tokenCount = tokenService.countTokens(OPENAI_MODELS.BASIC, content);

      await aiRepository.insertMessage({
        threadId: thread.id,
        role: MESSAGE_ROLE.SUMMARY,
        tokenCount,
        content,
      });

      const newContent = "User said Goodbye";
      const newTokenCount = tokenService.countTokens(OPENAI_MODELS.BASIC, newContent);

      const updatedSummary = await aiRepository.updateSummary(thread.id, newContent, newTokenCount);

      expect(updatedSummary.content).toBe(newContent);
    });

    it("should update thread status to completed", async () => {
      const newThread = await aiRepository.updateThread(thread.id, {
        status: THREAD_STATUS.COMPLETED,
      });

      expect(newThread.status).toBe(THREAD_STATUS.COMPLETED);
    });

    it("should set all threads to archived", async () => {
      await aiRepository.setThreadsToArchived(aiMentorLesson.lessonId, course.authorId);

      const threads = await aiRepository.findThreads([
        eq(aiMentorThreads.aiMentorLessonId, aiMentorLesson.id),
        eq(aiMentorThreads.userId, course.authorId),
      ]);

      const allThreads = threads.every((thread) => thread.status === THREAD_STATUS.ARCHIVED);

      expect(allThreads).toBe(true);
    });
  });
});
