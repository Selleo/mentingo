import {
  AI_MENTOR_TYPE,
  COURSE_ENROLLMENT,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
  type SupportedLanguages,
} from "@repo/shared";
import { and, eq, inArray } from "drizzle-orm";
import request from "supertest";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { LEARNING_MODE_REQUIRED_ERROR_KEY } from "src/common/utils/lessonLearningAccess";
import { FileService } from "src/file/file.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { QUESTION_TYPE } from "src/questions/schema/question.types";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  lessons,
  chapters,
  quizAttempts,
  questions,
  questionAnswerOptions,
  courseStudentMode,
  studentCourses,
  studentLessonProgress,
  studentQuestionAnswers,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

describe("LessonController (e2e) - quiz feedback redaction", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  const password = "password123";

  beforeAll(async () => {
    const mockFileService = {
      getFileUrl: jest.fn().mockResolvedValue("http://example.com/file"),
      isBunnyConfigured: jest.fn().mockResolvedValue(false),
      getResourcesForEntity: jest.fn().mockResolvedValue([]),
    };

    const mockCacheManager = {
      get: jest.fn().mockResolvedValue(""),
      set: jest.fn().mockResolvedValue(""),
    };

    const { app: testApp } = await createE2ETest([
      {
        provide: FileService,
        useValue: mockFileService,
      },
      {
        provide: "CACHE_MANAGER",
        useValue: mockCacheManager,
      },
    ]);

    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await truncateTables(baseDb, [
      "quiz_attempts",
      "course_student_mode",
      "courses",
      "chapters",
      "lessons",
      "questions",
      "question_answer_options",
      "student_question_answers",
      "student_lesson_progress",
      "student_chapter_progress",
      "student_courses",
      "users",
      "categories",
      "settings",
    ]);
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
  });

  describe("AI mentor lesson translations", () => {
    const createAiMentorLessonSetup = async (
      availableLocales: SupportedLanguages[] = [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL],
    ) => {
      const category = await categoryFactory.create();
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const adminCookies = await cookieFor(admin, app);
      const course = await courseFactory.create({
        authorId: admin.id,
        categoryId: category.id,
        baseLanguage: SUPPORTED_LANGUAGES.EN,
        availableLocales,
      });
      const chapter = await chapterFactory.create({ courseId: course.id, authorId: admin.id });

      const createResponse = await request(app.getHttpServer())
        .post("/api/lesson/beta-create-lesson/ai")
        .set("Cookie", adminCookies)
        .send({
          title: "Negotiation practice",
          description: "<p>Practice a sales call.</p>",
          chapterId: chapter.id,
          aiMentorInstructions: "<p>Lead the learner through an English scenario.</p>",
          completionConditions: "<p>The learner handles objections in English.</p>",
          type: AI_MENTOR_TYPE.MENTOR,
          name: "AI Mentor",
        })
        .expect(201);

      const lessonId = createResponse.body.data.id;

      return { adminCookies, courseId: course.id, lessonId };
    };

    const getAiMentorFromCourse = async (
      courseId: UUIDType,
      lessonId: UUIDType,
      language: SupportedLanguages,
      cookies: Awaited<ReturnType<typeof cookieFor>>,
    ) => {
      const response = await request(app.getHttpServer())
        .get("/api/course/beta-course-by-id")
        .query({ id: courseId, language })
        .set("Cookie", cookies)
        .expect(200);

      const lessonsList = response.body.data.chapters.flatMap(
        (chapter: { lessons: Array<{ id: UUIDType; aiMentor: unknown }> }) => chapter.lessons,
      );

      return lessonsList.find((lesson: { id: UUIDType }) => lesson.id === lessonId)?.aiMentor;
    };

    it("updates only the selected language and returns localized AI mentor scenario fields", async () => {
      const { adminCookies, courseId, lessonId } = await createAiMentorLessonSetup();

      await request(app.getHttpServer())
        .patch("/api/lesson/beta-update-lesson/ai")
        .query({ id: lessonId })
        .set("Cookie", adminCookies)
        .send({
          title: "Polish negotiation practice",
          description: "<p>Practice a Polish sales call.</p>",
          aiMentorInstructions: "<p>Lead the learner through a Polish scenario.</p>",
          completionConditions: "<p>The learner handles objections in Polish.</p>",
          type: AI_MENTOR_TYPE.MENTOR,
          name: "AI Mentor",
          language: SUPPORTED_LANGUAGES.PL,
        })
        .expect(200);

      const englishAiMentor = await getAiMentorFromCourse(
        courseId,
        lessonId,
        SUPPORTED_LANGUAGES.EN,
        adminCookies,
      );
      const polishAiMentor = await getAiMentorFromCourse(
        courseId,
        lessonId,
        SUPPORTED_LANGUAGES.PL,
        adminCookies,
      );

      expect(englishAiMentor).toMatchObject({
        aiMentorInstructions: "<p>Lead the learner through an English scenario.</p>",
        completionConditions: "<p>The learner handles objections in English.</p>",
      });
      expect(polishAiMentor).toMatchObject({
        aiMentorInstructions: "<p>Lead the learner through a Polish scenario.</p>",
        completionConditions: "<p>The learner handles objections in Polish.</p>",
      });
    });

    it("falls back to base-language AI mentor scenario fields", async () => {
      const { adminCookies, courseId, lessonId } = await createAiMentorLessonSetup([
        SUPPORTED_LANGUAGES.EN,
        SUPPORTED_LANGUAGES.DE,
      ]);

      const aiMentor = await getAiMentorFromCourse(
        courseId,
        lessonId,
        SUPPORTED_LANGUAGES.DE,
        adminCookies,
      );

      expect(aiMentor).toMatchObject({
        aiMentorInstructions: "<p>Lead the learner through an English scenario.</p>",
        completionConditions: "<p>The learner handles objections in English.</p>",
      });
    });

    it("rejects AI mentor scenario updates for unavailable languages", async () => {
      const { adminCookies, lessonId } = await createAiMentorLessonSetup();

      const response = await request(app.getHttpServer())
        .patch("/api/lesson/beta-update-lesson/ai")
        .query({ id: lessonId })
        .set("Cookie", adminCookies)
        .send({
          title: "German negotiation practice",
          description: "<p>Practice a German sales call.</p>",
          aiMentorInstructions: "<p>Lead the learner through a German scenario.</p>",
          completionConditions: "<p>The learner handles objections in German.</p>",
          type: AI_MENTOR_TYPE.MENTOR,
          name: "AI Mentor",
          language: SUPPORTED_LANGUAGES.DE,
        })
        .expect(400);

      expect(response.body.message).toBe("adminCourseView.toast.languageNotSupported");
    });
  });

  const createQuizLesson = async (courseId: UUIDType, chapterId: UUIDType, authorId: UUIDType) => {
    await db
      .update(chapters)
      .set({ lessonCount: 1, updatedAt: new Date().toISOString() })
      .where(eq(chapters.id, chapterId));

    const [lesson] = await db
      .insert(lessons)
      .values({
        id: crypto.randomUUID(),
        chapterId,
        type: LESSON_TYPES.QUIZ,
        title: buildJsonbField("en", "Test Quiz Lesson"),
        description: buildJsonbField("en", "Test description"),
        thresholdScore: 70,
        displayOrder: 1,
        fileS3Key: null,
        fileType: null,
        isExternal: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    const [question1] = await db
      .insert(questions)
      .values({
        id: crypto.randomUUID(),
        lessonId: lesson.id,
        authorId,
        type: QUESTION_TYPE.SINGLE_CHOICE,
        title: buildJsonbField("en", "What is 2+2?"),
        description: buildJsonbField("en", "Simple math question"),
        displayOrder: 1,
        solutionExplanation: buildJsonbField("en", "The answer is 4"),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    const options = await db
      .insert(questionAnswerOptions)
      .values([
        {
          id: crypto.randomUUID(),
          questionId: question1.id,
          optionText: buildJsonbField("en", "3"),
          isCorrect: false,
          displayOrder: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          questionId: question1.id,
          optionText: buildJsonbField("en", "4"),
          isCorrect: true,
          displayOrder: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          questionId: question1.id,
          optionText: buildJsonbField("en", "5"),
          isCorrect: false,
          displayOrder: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
      .returning();

    return { lesson, question: question1, correctOption: options[1] };
  };

  const createContentLesson = async (chapterId: UUIDType) => {
    const [lesson] = await db
      .insert(lessons)
      .values({
        id: crypto.randomUUID(),
        chapterId,
        type: LESSON_TYPES.CONTENT,
        title: buildJsonbField("en", "Test Content Lesson"),
        description: buildJsonbField("en", "Test content"),
        displayOrder: 1,
        fileS3Key: null,
        fileType: null,
        isExternal: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return lesson;
  };

  const buildQuizAnswers = async (lessonId: UUIDType) => {
    const quizQuestions = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.lessonId, lessonId))
      .orderBy(questions.displayOrder);

    const questionsAnswers = await Promise.all(
      quizQuestions.map(async (question) => {
        const [correctOption] = await db
          .select({ id: questionAnswerOptions.id })
          .from(questionAnswerOptions)
          .where(
            and(
              eq(questionAnswerOptions.questionId, question.id),
              eq(questionAnswerOptions.isCorrect, true),
            ),
          )
          .orderBy(questionAnswerOptions.displayOrder)
          .limit(1);

        if (!correctOption) {
          throw new Error(`Missing correct option for question ${question.id}`);
        }

        return {
          questionId: question.id,
          answers: [{ answerId: correctOption.id }],
        };
      }),
    );

    return questionsAnswers;
  };

  const enrollStudentToCourse = async (studentId: UUIDType, courseId: UUIDType) => {
    await db.insert(studentCourses).values({
      id: crypto.randomUUID(),
      studentId,
      courseId,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const enableStudentMode = async (studentId: UUIDType, courseId: UUIDType) => {
    await db
      .insert(studentCourses)
      .values({
        id: crypto.randomUUID(),
        studentId,
        courseId,
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();

    await db
      .insert(courseStudentMode)
      .values({
        id: crypto.randomUUID(),
        userId: studentId,
        courseId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();
  };

  const resetQuizAttemptState = async (studentId: UUIDType, lessonId: UUIDType) => {
    const quizQuestions = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.lessonId, lessonId));

    await db.delete(studentQuestionAnswers).where(
      and(
        eq(studentQuestionAnswers.studentId, studentId),
        inArray(
          studentQuestionAnswers.questionId,
          quizQuestions.map((question) => question.id),
        ),
      ),
    );

    await db
      .delete(studentLessonProgress)
      .where(
        and(
          eq(studentLessonProgress.studentId, studentId),
          eq(studentLessonProgress.lessonId, lessonId),
        ),
      );
  };

  describe("DELETE /api/lesson - quiz lesson deletion", () => {
    it("should delete a quiz lesson with linked quiz attempts", async () => {
      const category = await categoryFactory.create();
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const adminCookies = await cookieFor(admin, app);
      const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });

      const course = await courseFactory.create({
        authorId: admin.id,
        categoryId: category.id,
        status: "published",
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: true,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id });
      const { lesson } = await createQuizLesson(course.id, chapter.id, admin.id);

      await db.insert(quizAttempts).values({
        id: crypto.randomUUID(),
        userId: student.id,
        courseId: course.id,
        lessonId: lesson.id,
        correctAnswers: 1,
        wrongAnswers: 0,
        score: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const response = await request(app.getHttpServer())
        .delete("/api/lesson")
        .query({ lessonId: lesson.id })
        .set("Cookie", adminCookies)
        .expect(200);

      expect(response.body.data.message).toBe(
        "adminCourseView.curriculum.lesson.toast.lessonDeletedSuccessfully",
      );

      const deletedLessons = await db
        .select({ id: lessons.id })
        .from(lessons)
        .where(eq(lessons.id, lesson.id));
      const remainingQuizAttempts = await db
        .select({ id: quizAttempts.id })
        .from(quizAttempts)
        .where(eq(quizAttempts.lessonId, lesson.id));

      expect(deletedLessons).toHaveLength(0);
      expect(remainingQuizAttempts).toHaveLength(0);
    });
  });

  describe("GET /api/lesson/:id - quiz feedback redaction", () => {
    it("should redact quiz feedback for student when quizFeedbackEnabled is false", async () => {
      const category = await categoryFactory.create();
      const contentCreator = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const cookies = await cookieFor(student, app);

      const course = await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "published",
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: false,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id });
      await enrollStudentToCourse(student.id, course.id);

      const { lesson } = await createQuizLesson(course.id, chapter.id, contentCreator.id);

      const response = await request(app.getHttpServer())
        .get(`/api/lesson/${lesson.id}?language=en`)
        .set("Cookie", cookies)
        .expect(200);

      expect(response.body.data.isQuizFeedbackRedacted).toBe(true);
      expect(response.body.data.quizDetails).toBeDefined();

      if (response.body.data.quizDetails.questions) {
        for (const question of response.body.data.quizDetails.questions) {
          expect(question.passQuestion === false || question.passQuestion === null).toBe(true);
          if (question.options && question.options.length > 0) {
            for (const option of question.options as Array<{ isCorrect: boolean | null }>) {
              expect(option.isCorrect === false || option.isCorrect === null).toBe(true);
            }
          }
        }
      }
    });

    it("should show full quiz feedback for student when quizFeedbackEnabled is true", async () => {
      const category = await categoryFactory.create();
      const contentCreator = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const cookies = await cookieFor(student, app);

      const course = await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "published",
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: true,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id });
      await enrollStudentToCourse(student.id, course.id);

      const { lesson } = await createQuizLesson(course.id, chapter.id, contentCreator.id);

      const response = await request(app.getHttpServer())
        .get(`/api/lesson/${lesson.id}?language=en`)
        .set("Cookie", cookies)
        .expect(200);

      expect(response.body.data.isQuizFeedbackRedacted).toBe(false);
      expect(response.body.data.quizDetails).toBeDefined();
      expect(response.body.data.thresholdScore).toBe(70);

      if (
        response.body.data.quizDetails.questions &&
        response.body.data.quizDetails.questions.length > 0
      ) {
        const firstQuestion = response.body.data.quizDetails.questions[0];
        expect(firstQuestion.options).toBeDefined();
        expect(firstQuestion.options?.length).toBeGreaterThan(0);
      }
    });

    it("should show full quiz feedback for admin regardless of quizFeedbackEnabled", async () => {
      const category = await categoryFactory.create();
      const contentCreator = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const cookies = await cookieFor(admin, app);

      const course = await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "published",
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: false,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id });

      const { lesson } = await createQuizLesson(course.id, chapter.id, contentCreator.id);

      const response = await request(app.getHttpServer())
        .get(`/api/lesson/${lesson.id}?language=en`)
        .set("Cookie", cookies)
        .expect(200);

      expect(response.body.data.isQuizFeedbackRedacted).toBe(false);
      expect(response.body.data.quizDetails).toBeDefined();
      expect(response.body.data.thresholdScore).toBe(70);
    });
  });

  describe("POST /api/studentLessonProgress", () => {
    it("allows an enrolled content creator to complete another author's lesson without learning mode", async () => {
      const category = await categoryFactory.create();
      const author = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
      const contentCreator = await userFactory
        .withCredentials({ password })
        .withContentCreatorSettings(db)
        .create();
      const cookies = await cookieFor(contentCreator, app);

      const course = await courseFactory.create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
        chapterCount: 1,
      });
      const chapter = await chapterFactory.create({
        courseId: course.id,
        authorId: author.id,
        lessonCount: 1,
      });
      const lesson = await createContentLesson(chapter.id);
      await enrollStudentToCourse(contentCreator.id, course.id);

      await request(app.getHttpServer())
        .post("/api/studentLessonProgress")
        .query({ id: lesson.id, language: "en" })
        .set("Cookie", cookies)
        .expect(201);

      const [progress] = await db
        .select()
        .from(studentLessonProgress)
        .where(
          and(
            eq(studentLessonProgress.studentId, contentCreator.id),
            eq(studentLessonProgress.lessonId, lesson.id),
          ),
        );

      expect(progress?.completedAt).toBeTruthy();
    });

    it("does not complete a course author's lesson unless learning mode is active", async () => {
      const category = await categoryFactory.create();
      const author = await userFactory
        .withCredentials({ password })
        .withContentCreatorSettings(db)
        .create();
      const cookies = await cookieFor(author, app);

      const course = await courseFactory.create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
        chapterCount: 1,
      });
      const chapter = await chapterFactory.create({
        courseId: course.id,
        authorId: author.id,
        lessonCount: 1,
      });
      const lesson = await createContentLesson(chapter.id);
      await enrollStudentToCourse(author.id, course.id);

      await request(app.getHttpServer())
        .post("/api/studentLessonProgress")
        .query({ id: lesson.id, language: "en" })
        .set("Cookie", cookies)
        .expect(201);

      const progress = await db
        .select()
        .from(studentLessonProgress)
        .where(
          and(
            eq(studentLessonProgress.studentId, author.id),
            eq(studentLessonProgress.lessonId, lesson.id),
          ),
        );

      expect(progress).toHaveLength(0);
    });

    it("does not complete a lesson for an admin unless learning mode is active", async () => {
      const category = await categoryFactory.create();
      const author = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const cookies = await cookieFor(admin, app);

      const course = await courseFactory.create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
        chapterCount: 1,
      });
      const chapter = await chapterFactory.create({
        courseId: course.id,
        authorId: author.id,
        lessonCount: 1,
      });
      const lesson = await createContentLesson(chapter.id);

      await request(app.getHttpServer())
        .post("/api/studentLessonProgress")
        .query({ id: lesson.id, language: "en" })
        .set("Cookie", cookies)
        .expect(201);

      const progress = await db
        .select()
        .from(studentLessonProgress)
        .where(
          and(
            eq(studentLessonProgress.studentId, admin.id),
            eq(studentLessonProgress.lessonId, lesson.id),
          ),
        );

      expect(progress).toHaveLength(0);
    });

    it("allows an admin to complete a lesson in learning mode on any course", async () => {
      const category = await categoryFactory.create();
      const author = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const cookies = await cookieFor(admin, app);

      const course = await courseFactory.create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
        chapterCount: 1,
      });
      const chapter = await chapterFactory.create({
        courseId: course.id,
        authorId: author.id,
        lessonCount: 1,
      });
      const lesson = await createContentLesson(chapter.id);
      await enableStudentMode(admin.id, course.id);

      await request(app.getHttpServer())
        .post("/api/studentLessonProgress")
        .query({ id: lesson.id, language: "en" })
        .set("Cookie", cookies)
        .expect(201);

      const [progress] = await db
        .select()
        .from(studentLessonProgress)
        .where(
          and(
            eq(studentLessonProgress.studentId, admin.id),
            eq(studentLessonProgress.lessonId, lesson.id),
          ),
        );

      expect(progress?.completedAt).toBeTruthy();
    });
  });

  describe("POST /api/lesson/evaluation-quiz - quiz feedback redaction", () => {
    it("should redact quiz results for student when quizFeedbackEnabled is false", async () => {
      const category = await categoryFactory.create();
      const contentCreator = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const cookies = await cookieFor(student, app);

      const course = await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "published",
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: false,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id });
      await enrollStudentToCourse(student.id, course.id);

      const { lesson } = await createQuizLesson(course.id, chapter.id, contentCreator.id);

      const questionsAnswers = await buildQuizAnswers(lesson.id);
      await resetQuizAttemptState(student.id, lesson.id);

      const response = await request(app.getHttpServer())
        .post("/api/lesson/evaluation-quiz")
        .set("Cookie", cookies)
        .send({
          lessonId: lesson.id,
          language: "en",
          questionsAnswers,
        })
        .expect(201);

      expect(response.body.data.data.correctAnswerCount).toBe(1);
      expect(response.body.data.data.wrongAnswerCount).toBe(0);
      expect(response.body.data.data.score).toBe(100);
      expect(response.body.data.data.questionCount).toBeGreaterThan(0);
    });

    it("should show full quiz results for student when quizFeedbackEnabled is true", async () => {
      const category = await categoryFactory.create();
      const contentCreator = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const cookies = await cookieFor(student, app);

      const course = await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "published",
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: true,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id });
      await enrollStudentToCourse(student.id, course.id);

      const { lesson } = await createQuizLesson(course.id, chapter.id, contentCreator.id);

      const questionsAnswers = await buildQuizAnswers(lesson.id);
      await resetQuizAttemptState(student.id, lesson.id);

      const response = await request(app.getHttpServer())
        .post("/api/lesson/evaluation-quiz")
        .set("Cookie", cookies)
        .send({
          lessonId: lesson.id,
          language: "en",
          questionsAnswers,
        })
        .expect(201);

      expect(response.body.data.data.correctAnswerCount).toBeGreaterThan(0);
      expect(response.body.data.data.score).toBeGreaterThan(0);
      expect(response.body.data.data.questionCount).toBeGreaterThan(0);
    });

    it("allows an enrolled content creator to submit another author's quiz without learning mode", async () => {
      const category = await categoryFactory.create();
      const author = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
      const contentCreator = await userFactory
        .withCredentials({ password })
        .withContentCreatorSettings(db)
        .create();
      const cookies = await cookieFor(contentCreator, app);

      const course = await courseFactory.create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: true,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id, authorId: author.id });
      await enrollStudentToCourse(contentCreator.id, course.id);

      const { lesson } = await createQuizLesson(course.id, chapter.id, author.id);
      const questionsAnswers = await buildQuizAnswers(lesson.id);
      await resetQuizAttemptState(contentCreator.id, lesson.id);

      const response = await request(app.getHttpServer())
        .post("/api/lesson/evaluation-quiz")
        .set("Cookie", cookies)
        .send({
          lessonId: lesson.id,
          language: "en",
          questionsAnswers,
        })
        .expect(201);

      expect(response.body.data.data.score).toBe(100);

      const [progress] = await db
        .select()
        .from(studentLessonProgress)
        .where(
          and(
            eq(studentLessonProgress.studentId, contentCreator.id),
            eq(studentLessonProgress.lessonId, lesson.id),
          ),
        );

      expect(progress?.completedAt).toBeTruthy();
      expect(progress?.isQuizPassed).toBe(true);
    });

    it("requires learning mode when the course author submits their own quiz", async () => {
      const category = await categoryFactory.create();
      const author = await userFactory
        .withCredentials({ password })
        .withContentCreatorSettings(db)
        .create();
      const cookies = await cookieFor(author, app);

      const course = await courseFactory.create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: true,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id, authorId: author.id });
      await enrollStudentToCourse(author.id, course.id);

      const { lesson } = await createQuizLesson(course.id, chapter.id, author.id);
      const questionsAnswers = await buildQuizAnswers(lesson.id);
      await resetQuizAttemptState(author.id, lesson.id);

      const response = await request(app.getHttpServer())
        .post("/api/lesson/evaluation-quiz")
        .set("Cookie", cookies)
        .send({
          lessonId: lesson.id,
          language: "en",
          questionsAnswers,
        })
        .expect(403);

      expect(response.body.message).toBe(LEARNING_MODE_REQUIRED_ERROR_KEY);
    });

    it("allows the course author to submit their own quiz in learning mode", async () => {
      const category = await categoryFactory.create();
      const author = await userFactory
        .withCredentials({ password })
        .withContentCreatorSettings(db)
        .create();
      const cookies = await cookieFor(author, app);

      const course = await courseFactory.create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: true,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id, authorId: author.id });
      await enrollStudentToCourse(author.id, course.id);
      await enableStudentMode(author.id, course.id);

      const { lesson } = await createQuizLesson(course.id, chapter.id, author.id);
      const questionsAnswers = await buildQuizAnswers(lesson.id);
      await resetQuizAttemptState(author.id, lesson.id);

      const response = await request(app.getHttpServer())
        .post("/api/lesson/evaluation-quiz")
        .set("Cookie", cookies)
        .send({
          lessonId: lesson.id,
          language: "en",
          questionsAnswers,
        })
        .expect(201);

      expect(response.body.data.data.score).toBe(100);

      const [progress] = await db
        .select()
        .from(studentLessonProgress)
        .where(
          and(
            eq(studentLessonProgress.studentId, author.id),
            eq(studentLessonProgress.lessonId, lesson.id),
          ),
        );

      expect(progress?.completedAt).toBeTruthy();
      expect(progress?.isQuizPassed).toBe(true);
    });

    it("requires learning mode when an admin submits a quiz", async () => {
      const category = await categoryFactory.create();
      const author = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const cookies = await cookieFor(admin, app);

      const course = await courseFactory.create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: true,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id, authorId: author.id });

      const { lesson } = await createQuizLesson(course.id, chapter.id, author.id);
      const questionsAnswers = await buildQuizAnswers(lesson.id);
      await resetQuizAttemptState(admin.id, lesson.id);

      const response = await request(app.getHttpServer())
        .post("/api/lesson/evaluation-quiz")
        .set("Cookie", cookies)
        .send({
          lessonId: lesson.id,
          language: "en",
          questionsAnswers,
        })
        .expect(403);

      expect(response.body.message).toBe(LEARNING_MODE_REQUIRED_ERROR_KEY);
    });

    it("allows an admin to submit a quiz in learning mode on any course", async () => {
      const category = await categoryFactory.create();
      const author = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const cookies = await cookieFor(admin, app);

      const course = await courseFactory.create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: true,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id, authorId: author.id });
      await enableStudentMode(admin.id, course.id);

      const { lesson } = await createQuizLesson(course.id, chapter.id, author.id);
      const questionsAnswers = await buildQuizAnswers(lesson.id);
      await resetQuizAttemptState(admin.id, lesson.id);

      const response = await request(app.getHttpServer())
        .post("/api/lesson/evaluation-quiz")
        .set("Cookie", cookies)
        .send({
          lessonId: lesson.id,
          language: "en",
          questionsAnswers,
        })
        .expect(201);

      expect(response.body.data.data.score).toBe(100);

      const [progress] = await db
        .select()
        .from(studentLessonProgress)
        .where(
          and(
            eq(studentLessonProgress.studentId, admin.id),
            eq(studentLessonProgress.lessonId, lesson.id),
          ),
        );

      expect(progress?.completedAt).toBeTruthy();
      expect(progress?.isQuizPassed).toBe(true);
    });

    it("should update quiz feedback redaction after changing course settings", async () => {
      const category = await categoryFactory.create();
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const adminCookies = await cookieFor(admin, app);
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const studentCookies = await cookieFor(student, app);

      const course = await courseFactory.create({
        authorId: admin.id,
        categoryId: category.id,
        status: "published",
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: true,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id });
      await enrollStudentToCourse(student.id, course.id);

      const { lesson } = await createQuizLesson(course.id, chapter.id, admin.id);

      const initialResponse = await request(app.getHttpServer())
        .get(`/api/lesson/${lesson.id}?language=en`)
        .set("Cookie", studentCookies)
        .expect(200);

      expect(initialResponse.body.data.isQuizFeedbackRedacted).toBe(false);

      await request(app.getHttpServer())
        .patch(`/api/course/settings/${course.id}`)
        .set("Cookie", adminCookies)
        .send({ quizFeedbackEnabled: false })
        .expect(200);

      const updatedResponse = await request(app.getHttpServer())
        .get(`/api/lesson/${lesson.id}?language=en`)
        .set("Cookie", studentCookies)
        .expect(200);

      expect(updatedResponse.body.data.isQuizFeedbackRedacted).toBe(true);

      const evaluationStudent = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const evaluationStudentCookies = await cookieFor(evaluationStudent, app);
      await enrollStudentToCourse(evaluationStudent.id, course.id);

      const questionsAnswers = await buildQuizAnswers(lesson.id);
      await resetQuizAttemptState(evaluationStudent.id, lesson.id);

      const evaluationResponse = await request(app.getHttpServer())
        .post("/api/lesson/evaluation-quiz")
        .set("Cookie", evaluationStudentCookies)
        .send({
          lessonId: lesson.id,
          language: "en",
          questionsAnswers,
        })
        .expect(201);

      expect(evaluationResponse.body.data.data.correctAnswerCount).toBe(1);
      expect(evaluationResponse.body.data.data.score).toBe(100);
    });
  });
});
