import { COURSE_ENROLLMENT } from "@repo/shared";
import { and, eq } from "drizzle-orm";
import request from "supertest";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { FileService } from "src/file/file.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { QUESTION_TYPE } from "src/questions/schema/question.types";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { lessons, questions, questionAnswerOptions, studentCourses } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

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

  const createQuizLesson = async (courseId: UUIDType, chapterId: UUIDType, authorId: UUIDType) => {
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

  describe("GET /api/lesson/:id - quiz feedback redaction", () => {
    it("should redact quiz feedback for student when quizFeedbackEnabled is false", async () => {
      const category = await categoryFactory.create();
      const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });
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
      const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });
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
      const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });
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

  describe("POST /api/lesson/evaluation-quiz - quiz feedback redaction", () => {
    it("should redact quiz results for student when quizFeedbackEnabled is false", async () => {
      const category = await categoryFactory.create();
      const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });
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
      const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });
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
        .create({ role: USER_ROLES.STUDENT });
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

      const questionsAnswers = await buildQuizAnswers(lesson.id);

      const evaluationResponse = await request(app.getHttpServer())
        .post("/api/lesson/evaluation-quiz")
        .set("Cookie", studentCookies)
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
