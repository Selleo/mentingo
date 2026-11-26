import { Readable } from "stream";

import {
  COURSE_STATUSES,
  DEFAULT_CERTIFICATE_FONT_COLOR,
  LESSON_TYPES,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { and, eq, isNull } from "drizzle-orm";
import request from "supertest";

import { setJsonbField } from "src/common/helpers/sqlHelpers";
import { FILE_DELIVERY_TYPE } from "src/file/types/file-delivery.type";
import {
  assessmentAttempts,
  courseStudentMode,
  settings,
  studentCourses,
  studentLessonProgress,
} from "src/storage/schema";

import { createChapterFactory } from "../factory/chapter.factory";
import { createCourseStudentModeFactory } from "../factory/course-student-mode.factory";
import { createCourseFactory } from "../factory/course.factory";
import { createLessonFactory } from "../factory/lesson.factory";
import {
  createOpenTextQuestionFactory,
  createQuizAssessmentFactory,
} from "../factory/quiz-assessment.factory";
import { createStudentCourseFactory } from "../factory/student-course.factory";
import { createUserFactory } from "../factory/user.factory";

import { COURSE_ENROLLMENT_TABLES, createCourseEnrollmentHelpers } from "./course-enrollment";
import { assignSystemRoleToUserInTests } from "./permission-role-helpers";
import { cookieFor } from "./test-helpers";

import type { SignedInUser } from "./course-enrollment";
import type { truncateTables } from "./test-helpers";
import type { INestApplication } from "@nestjs/common";
import type { AssessmentFeedbackMode } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { CourseTest } from "test/factory/course.factory";
import type { LessonTest } from "test/factory/lesson.factory";
import type { SeededQuizAssessment } from "test/factory/quiz-assessment.factory";
import type { UserWithCredentials } from "test/factory/user.factory";

export const LESSON_TABLES: Parameters<typeof truncateTables>[1] = [
  "outbox_events",
  "ai_mentor_judgements",
  "ai_mentor_threads",
  "scorm_packages",
  "resource_entity",
  "resources",
  "assessment_attempts",
  "assessment_feedback_ranges",
  "assessment_question_choice_options",
  "assessment_questions",
  "assessments",
  ...COURSE_ENROLLMENT_TABLES,
];

const LESSON_TEST_PASSWORD = "Password123@";

export const PUBLIC_VIDEO_CONTENT = "public video";

type RunInTenant = <T>(fn: () => Promise<T>) => Promise<T>;

type CourseOverrides = Partial<CourseTest>;

export type SeededQuizLesson = SeededQuizAssessment & {
  lesson: Awaited<ReturnType<ReturnType<typeof createLessonFactory>["create"]>>;
  correctOptionId: UUIDType;
  wrongOptionId: UUIDType;
};

export type QuizAnswers = Array<{
  questionId: UUIDType;
  answers: Array<{ answerId?: UUIDType; value?: string }>;
}>;

/** Narrows a value the test just created; fails loudly when the setup did not produce it. */
export const requirePresent = <T>(value: T | null | undefined, description: string): T => {
  if (value === null || value === undefined) throw new Error(`Missing ${description}`);

  return value;
};

/** File storage double: lesson resources stream a fixed video body. */
export const createFileServiceMock = () => ({
  getFileUrl: jest.fn(),
  isBunnyConfigured: jest.fn(),
  getResourcesForEntity: jest.fn(),
  getFileDeliveryWithPreview: jest.fn(),
});

export const resetFileServiceMock = (fileServiceMock: ReturnType<typeof createFileServiceMock>) => {
  Object.values(fileServiceMock).forEach((mock) => mock.mockReset());
  fileServiceMock.getFileUrl.mockResolvedValue("http://example.com/file");
  fileServiceMock.isBunnyConfigured.mockResolvedValue(false);
  fileServiceMock.getResourcesForEntity.mockResolvedValue([]);
  fileServiceMock.getFileDeliveryWithPreview.mockImplementation(async () => ({
    type: FILE_DELIVERY_TYPE.STREAM,
    stream: Readable.from([PUBLIC_VIDEO_CONTENT]),
    contentType: "video/mp4",
    contentLength: PUBLIC_VIDEO_CONTENT.length,
  }));
};

export const createCacheManagerMock = () => ({ get: jest.fn(), set: jest.fn() });

export const resetCacheManagerMock = (
  cacheManagerMock: ReturnType<typeof createCacheManagerMock>,
) => {
  Object.values(cacheManagerMock).forEach((mock) => mock.mockReset());
  cacheManagerMock.get.mockResolvedValue("");
  cacheManagerMock.set.mockResolvedValue("");
};

/** The answers that pick the correct option of every seeded choice question. */
export const correctAnswersFor = ({ question, correctOptionId }: SeededQuizLesson): QuizAnswers => [
  { questionId: question.id, answers: [{ answerId: correctOptionId }] },
];

/** Seeds and reads lessons, quizzes and learner progress through the tenant-scoped (RLS) connection. */
export const createLessonHelpers = ({
  app,
  db,
  runInTenant,
}: {
  app: INestApplication;
  db: DatabasePg;
  runInTenant: RunInTenant;
}) => {
  const enrollmentHelpers = createCourseEnrollmentHelpers({ app, db, runInTenant });

  const signIn = async (user: UserWithCredentials): Promise<SignedInUser> => ({
    user,
    cookies: await cookieFor(user, app),
  });

  const arrangeSignedInStudent = async (attributes: Partial<UserWithCredentials> = {}) =>
    signIn(
      await runInTenant(() =>
        createUserFactory(db)
          .withCredentials({ password: LESSON_TEST_PASSWORD })
          .withUserSettings(db)
          .create(attributes),
      ),
    );

  /** Reviewers need user settings to sign in, so a student with settings is promoted. */
  const arrangeSignedInReviewer = async () =>
    signIn(
      await runInTenant(async () => {
        const user = await createUserFactory(db)
          .withCredentials({ password: LESSON_TEST_PASSWORD })
          .withUserSettings(db)
          .create();
        await assignSystemRoleToUserInTests(db, user.id, user.tenantId, SYSTEM_ROLE_SLUGS.REVIEWER);

        return user;
      }),
    );

  const arrangeCourse = (overrides: CourseOverrides = {}) =>
    runInTenant(() => createCourseFactory(db).create({ thumbnailS3Key: null, ...overrides }));

  const arrangeChapter = (
    courseId: UUIDType,
    overrides: Partial<Parameters<ReturnType<typeof createChapterFactory>["create"]>[0]> = {},
  ) =>
    runInTenant(() =>
      createChapterFactory(db).create({ courseId, displayOrder: 1, lessonCount: 1, ...overrides }),
    );

  const arrangeLesson = (chapterId: UUIDType, overrides: Partial<LessonTest> = {}) =>
    runInTenant(() => createLessonFactory(db).create({ chapterId, ...overrides }));

  /** Seeds a chapter with one quiz lesson (pass mark 70%) holding a single-choice question. */
  const arrangeQuizLesson = ({
    courseId,
    authorId,
    feedbackMode,
  }: {
    courseId: UUIDType;
    authorId?: UUIDType;
    feedbackMode?: AssessmentFeedbackMode;
  }): Promise<SeededQuizLesson> =>
    runInTenant(async () => {
      const chapter = await createChapterFactory(db).create({
        courseId,
        authorId,
        displayOrder: 1,
        lessonCount: 1,
      });
      const lesson = await createLessonFactory(db).create({
        chapterId: chapter.id,
        type: LESSON_TYPES.QUIZ,
        title: { en: "Test Quiz Lesson" },
        thresholdScore: 70,
      });
      const quiz = await createQuizAssessmentFactory(db).create({
        lessonId: lesson.id,
        ...(feedbackMode ? { feedbackMode } : {}),
      });
      const correctOption = quiz.options.find(({ isCorrect }) => isCorrect);
      const wrongOption = quiz.options.find(({ isCorrect }) => !isCorrect);

      if (!correctOption || !wrongOption)
        throw new Error("Quiz needs a correct and a wrong option");

      return {
        ...quiz,
        lesson,
        correctOptionId: correctOption.id,
        wrongOptionId: wrongOption.id,
      };
    });

  /** Seeds a published course without lesson sequencing whose only lesson is a quiz. */
  const arrangeQuizCourse = async ({
    authorId,
    quizFeedbackEnabled = true,
    feedbackMode,
  }: {
    authorId: UUIDType;
    quizFeedbackEnabled?: boolean;
    feedbackMode?: AssessmentFeedbackMode;
  }) => {
    const course = await arrangeCourse({
      authorId,
      status: COURSE_STATUSES.PUBLISHED,
      settings: {
        lessonSequenceEnabled: false,
        quizFeedbackEnabled,
        certificateSignature: null,
        certificateFontColor: DEFAULT_CERTIFICATE_FONT_COLOR,
        certificateValidity: null,
      },
    });
    const quiz = await arrangeQuizLesson({ courseId: course.id, feedbackMode });

    return { course, ...quiz };
  };

  const submitQuizAnswers = (
    actor: SignedInUser,
    lessonId: UUIDType,
    questionsAnswers: QuizAnswers,
  ) =>
    request(app.getHttpServer())
      .post("/api/lesson/evaluation-quiz")
      .set("Cookie", actor.cookies)
      .send({ lessonId, language: SUPPORTED_LANGUAGES.EN, questionsAnswers });

  const fetchLesson = async (actor: SignedInUser, lessonId: UUIDType) => {
    const response = await request(app.getHttpServer())
      .get(`/api/lesson/${lessonId}`)
      .query({ language: SUPPORTED_LANGUAGES.EN })
      .set("Cookie", actor.cookies)
      .expect(200);

    return response.body.data;
  };

  const arrangeOpenTextQuestion = (assessmentId: UUIDType) =>
    runInTenant(() => createOpenTextQuestionFactory(db).create({ assessmentId }));

  const arrangeEnrollment = (studentId: UUIDType, courseId: UUIDType) =>
    runInTenant(() => createStudentCourseFactory(db).create({ studentId, courseId }));

  /** Enrolls the user and turns learning mode on, as authors and admins do to take their own courses. */
  const arrangeLearningMode = (userId: UUIDType, courseId: UUIDType) =>
    runInTenant(async () => {
      await createStudentCourseFactory(db).create({ studentId: userId, courseId });
      await createCourseStudentModeFactory(db).create({ userId, courseId });
    });

  const updateGlobalSetting = (key: string, value: boolean) =>
    runInTenant(() =>
      db
        .update(settings)
        .set({ settings: setJsonbField(settings.settings, key, value) })
        .where(isNull(settings.userId)),
    );

  const findLessonProgress = (studentId: UUIDType, lessonId: UUIDType) =>
    runInTenant(() =>
      db
        .select()
        .from(studentLessonProgress)
        .where(
          and(
            eq(studentLessonProgress.studentId, studentId),
            eq(studentLessonProgress.lessonId, lessonId),
          ),
        ),
    );

  const findLearnerFootprint = (userId: UUIDType) =>
    runInTenant(async () => ({
      lessonProgress: await db
        .select()
        .from(studentLessonProgress)
        .where(eq(studentLessonProgress.studentId, userId)),
      enrollments: await db
        .select()
        .from(studentCourses)
        .where(eq(studentCourses.studentId, userId)),
      learningModes: await db
        .select()
        .from(courseStudentMode)
        .where(eq(courseStudentMode.userId, userId)),
    }));

  const findLearnerAttempts = (learnerId: UUIDType) =>
    runInTenant(() =>
      db.select().from(assessmentAttempts).where(eq(assessmentAttempts.learnerId, learnerId)),
    );

  return {
    ...enrollmentHelpers,
    arrangeSignedInStudent,
    arrangeSignedInReviewer,
    arrangeCourse,
    arrangeChapter,
    arrangeLesson,
    arrangeQuizLesson,
    arrangeQuizCourse,
    submitQuizAnswers,
    fetchLesson,
    arrangeOpenTextQuestion,
    arrangeEnrollment,
    arrangeLearningMode,
    updateGlobalSetting,
    findLessonProgress,
    findLearnerFootprint,
    findLearnerAttempts,
  };
};
