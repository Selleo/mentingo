import { COURSE_ENROLLMENT } from "@repo/shared";
import { and, eq } from "drizzle-orm";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { createUnitTest, type TestContext } from "test/create-unit-test";
import { createChapterFactory } from "test/factory/chapter.factory";
import { createCourseFactory } from "test/factory/course.factory";
import { createUserFactory } from "test/factory/user.factory";
import { truncateAllTables } from "test/helpers/test-helpers";

import { LESSON_TYPES } from "../lesson.type";
import { LessonService } from "../services/lesson.service";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { QUESTION_TYPE } from "src/questions/schema/question.types";
import { lessons, questions, questionAnswerOptions, studentCourses } from "src/storage/schema";

import type { DatabasePg, UUIDType } from "src/common";

describe("LessonService", () => {
  let testContext: TestContext;
  let lessonService: LessonService;
  let db: DatabasePg;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;
  let userFactory: ReturnType<typeof createUserFactory>;

  beforeAll(async () => {
    testContext = await createUnitTest();
    lessonService = testContext.module.get(LessonService);
    db = testContext.db;
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
    userFactory = createUserFactory(db);
  }, 30000);

  afterEach(async () => {
    await truncateAllTables(db);
  });

  afterAll(async () => {
    await testContext.teardown();
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

    await db.insert(questionAnswerOptions).values([
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
    ]);

    return lesson;
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

  describe("getLessonById - quiz feedback redaction", () => {
    it("should redact quiz feedback when quizFeedbackEnabled is false for student", async () => {
      const course = await courseFactory.create({
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: false,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id });
      const author = await userFactory.create();
      const student = await userFactory.create();
      await enrollStudentToCourse(student.id, course.id);

      const lesson = await createQuizLesson(course.id, chapter.id, author.id);

      const result = await lessonService.getLessonById(lesson.id, student.id, USER_ROLES.STUDENT);

      expect(result.isQuizFeedbackRedacted).toBe(true);
      expect(result.quizDetails).toBeDefined();
      expect(result.quizDetails?.score).toBe(0);
      expect(result.quizDetails?.correctAnswerCount).toBe(0);
      expect(result.quizDetails?.wrongAnswerCount).toBe(0);
      expect(result.thresholdScore).toBe(0);

      if (result.quizDetails?.questions) {
        for (const question of result.quizDetails.questions) {
          expect(question.passQuestion === false || question.passQuestion === null).toBe(true);
          if (question.options && question.options.length > 0) {
            for (const option of question.options) {
              expect(option.isCorrect === false || option.isCorrect === null).toBe(true);
            }
          }
        }
      }
    });

    it("should show full quiz feedback when quizFeedbackEnabled is true for student", async () => {
      const course = await courseFactory.create({
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: true,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id });
      const author = await userFactory.create();
      const student = await userFactory.create();
      await enrollStudentToCourse(student.id, course.id);

      const lesson = await createQuizLesson(course.id, chapter.id, author.id);

      const result = await lessonService.getLessonById(lesson.id, student.id, USER_ROLES.STUDENT);

      expect(result.isQuizFeedbackRedacted).toBe(false);
      expect(result.quizDetails).toBeDefined();
      expect(result.thresholdScore).toBe(70);

      if (result.quizDetails?.questions && result.quizDetails.questions.length > 0) {
        const firstQuestion = result.quizDetails.questions[0];
        expect(firstQuestion.options).toBeDefined();
        expect(firstQuestion.options?.length).toBeGreaterThan(0);
      }
    });

    it("should show full quiz feedback for admin regardless of quizFeedbackEnabled", async () => {
      const course = await courseFactory.create({
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: false,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id });
      const author = await userFactory.create();
      const admin = await userFactory.withAdminRole().create();

      const lesson = await createQuizLesson(course.id, chapter.id, author.id);

      const result = await lessonService.getLessonById(lesson.id, admin.id, USER_ROLES.ADMIN);

      expect(result.isQuizFeedbackRedacted).toBe(false);
      expect(result.quizDetails).toBeDefined();
      expect(result.thresholdScore).toBe(70);

      if (result.quizDetails?.questions && result.quizDetails.questions.length > 0) {
        const firstQuestion = result.quizDetails.questions[0];
        expect(firstQuestion.options).toBeDefined();
        expect(firstQuestion.options?.length).toBeGreaterThan(0);
      }
    });

    it("should show full quiz feedback for content creator regardless of quizFeedbackEnabled", async () => {
      const course = await courseFactory.create({
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: false,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id });
      const author = await userFactory.create();
      const contentCreator = await userFactory.create();

      const lesson = await createQuizLesson(course.id, chapter.id, author.id);

      const result = await lessonService.getLessonById(
        lesson.id,
        contentCreator.id,
        USER_ROLES.CONTENT_CREATOR,
      );

      expect(result.isQuizFeedbackRedacted).toBe(false);
      expect(result.quizDetails).toBeDefined();
      expect(result.thresholdScore).toBe(70);
    });
  });

  describe("evaluationQuiz - quiz feedback redaction", () => {
    it("should redact quiz results when quizFeedbackEnabled is false for student", async () => {
      const course = await courseFactory.create({
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: false,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id });
      const author = await userFactory.create();
      const student = await userFactory.create();
      await enrollStudentToCourse(student.id, course.id);

      const lesson = await createQuizLesson(course.id, chapter.id, author.id);

      const question = (
        await db.select().from(questions).where(eq(questions.lessonId, lesson.id)).limit(1)
      )[0];
      const correctOption = (
        await db
          .select()
          .from(questionAnswerOptions)
          .where(
            and(
              eq(questionAnswerOptions.questionId, question.id),
              eq(questionAnswerOptions.isCorrect, true),
            ),
          )
          .limit(1)
      )[0];

      const quizAnswers = {
        lessonId: lesson.id,
        language: "en" as const,
        questionsAnswers: [
          {
            questionId: question.id,
            answers: [{ answerId: correctOption.id }],
          },
        ],
      };

      const result = await lessonService.evaluationQuiz(
        quizAnswers,
        student.id,
        USER_ROLES.STUDENT,
      );

      expect(result.correctAnswerCount).toBe(0);
      expect(result.wrongAnswerCount).toBe(0);
      expect(result.score).toBe(0);
      expect(result.questionCount).toBeGreaterThan(0);
    });

    it("should show full quiz results when quizFeedbackEnabled is true for student", async () => {
      const course = await courseFactory.create({
        settings: {
          lessonSequenceEnabled: false,
          quizFeedbackEnabled: true,
        },
      });
      const chapter = await chapterFactory.create({ courseId: course.id });
      const author = await userFactory.create();
      const student = await userFactory.create();
      await enrollStudentToCourse(student.id, course.id);

      const lesson = await createQuizLesson(course.id, chapter.id, author.id);

      const question = (
        await db.select().from(questions).where(eq(questions.lessonId, lesson.id)).limit(1)
      )[0];
      const correctOption = (
        await db
          .select()
          .from(questionAnswerOptions)
          .where(
            and(
              eq(questionAnswerOptions.questionId, question.id),
              eq(questionAnswerOptions.isCorrect, true),
            ),
          )
          .limit(1)
      )[0];

      const quizAnswers = {
        lessonId: lesson.id,
        language: "en" as const,
        questionsAnswers: [
          {
            questionId: question.id,
            answers: [{ answerId: correctOption.id }],
          },
        ],
      };

      const result = await lessonService.evaluationQuiz(
        quizAnswers,
        student.id,
        USER_ROLES.STUDENT,
      );

      expect(result.correctAnswerCount).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThan(0);
      expect(result.questionCount).toBeGreaterThan(0);
    });
  });
});
