import { SUPPORTED_LANGUAGES } from "@repo/shared";
import request from "supertest";

import { S3Service } from "src/s3/s3.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createLessonFactory } from "../../../test/factory/lesson.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createStudentCourseFactory } from "../../../test/factory/student-course.factory";
import {
  createAiMentorStudentLessonProgressFactory,
  createStudentLessonProgressFactory,
} from "../../../test/factory/student-lesson-progress.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import {
  LEARNER_FIXTURES,
  LESSON_FIXTURES,
  LESSON_PROGRESS_FIXTURES,
  STATISTICS_ENDPOINTS,
  STATISTICS_LEARNERS,
  STATISTICS_LESSONS,
  STATISTICS_SORT_CASES,
} from "./course-statistics-sorting.scenarios";

import type {
  StatisticsEndpoint,
  StatisticsLearner,
  StatisticsLesson,
  StatisticsSortCase,
} from "./course-statistics-sorting.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

const COURSE_STATISTICS_TABLES = [
  "ai_mentor_student_lesson_progress",
  "student_lesson_progress",
  "student_chapter_progress",
  "student_courses",
  "lessons",
  "chapters",
  "courses",
  "categories",
  "group_users",
  "groups",
  "users",
  "settings",
] as const;

const PASSWORD = "password123";

const s3ServiceMock = {
  getSignedUrl: jest.fn(),
};

type StatisticsFixture = {
  courseId: UUIDType;
  learnerIdsByKey: Record<StatisticsLearner, UUIDType>;
  adminCookies: string;
};

describe("Course statistics sorting (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;
  let lessonFactory: ReturnType<typeof createLessonFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;
  let studentCourseFactory: ReturnType<typeof createStudentCourseFactory>;
  let studentLessonProgressFactory: ReturnType<typeof createStudentLessonProgressFactory>;
  let aiMentorProgressFactory: ReturnType<typeof createAiMentorStudentLessonProgressFactory>;
  let fixture: StatisticsFixture;
  let runAsDefaultTenant: <T>(fn: () => Promise<T>) => Promise<T>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        { provide: S3Service, useValue: s3ServiceMock },
        {
          provide: "CACHE_MANAGER",
          useValue: { get: jest.fn().mockResolvedValue(""), set: jest.fn() },
        },
      ],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runAsDefaultTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);

    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
    lessonFactory = createLessonFactory(db);
    groupFactory = createGroupFactory(db);
    studentCourseFactory = createStudentCourseFactory(db);
    studentLessonProgressFactory = createStudentLessonProgressFactory(db);
    aiMentorProgressFactory = createAiMentorStudentLessonProgressFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, [...COURSE_STATISTICS_TABLES]);
    s3ServiceMock.getSignedUrl.mockReset();
    s3ServiceMock.getSignedUrl.mockImplementation(
      async (key: string) => `https://storage.example.com/${key}`,
    );
    fixture = await runAsDefaultTenant(async () => {
      await settingsFactory.create({ userId: null });
      return arrangeCourseWithRankedLearners();
    });
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, [...COURSE_STATISTICS_TABLES]);
  });

  const arrangeCourseWithRankedLearners = async (): Promise<StatisticsFixture> => {
    const admin = await userFactory
      .withCredentials({ password: PASSWORD })
      .withAdminSettings(db)
      .create();
    const category = await categoryFactory.create();
    const course = await courseFactory.create({
      authorId: admin.id,
      categoryId: category.id,
      chapterCount: 1,
    });
    const chapter = await chapterFactory.create({
      authorId: admin.id,
      courseId: course.id,
      displayOrder: 1,
      lessonCount: Object.keys(LESSON_FIXTURES).length,
    });

    const lessonIdsByKey = {} as Record<StatisticsLesson, UUIDType>;
    for (const [lessonKey, lessonFixture] of Object.entries(LESSON_FIXTURES)) {
      const lesson = await lessonFactory.create({
        chapterId: chapter.id,
        type: lessonFixture.type,
        title: { [SUPPORTED_LANGUAGES.EN]: lessonFixture.title },
        displayOrder: lessonFixture.displayOrder,
        thresholdScore: lessonFixture.thresholdScore,
      });
      lessonIdsByKey[lessonKey as StatisticsLesson] = lesson.id;
    }

    const learnerIdsByKey = {} as Record<StatisticsLearner, UUIDType>;
    for (const [learnerKey, learnerFixture] of Object.entries(LEARNER_FIXTURES)) {
      const learner = await userFactory.withUserSettings(db).create({
        firstName: learnerFixture.firstName,
        lastName: learnerFixture.lastName,
      });
      await groupFactory.withMembers([learner.id]).create({ name: learnerFixture.groupName });
      await studentCourseFactory.create({ studentId: learner.id, courseId: course.id });
      learnerIdsByKey[learnerKey as StatisticsLearner] = learner.id;
    }

    for (const progress of LESSON_PROGRESS_FIXTURES) {
      const lessonProgress = await studentLessonProgressFactory.create({
        studentId: learnerIdsByKey[progress.learner],
        chapterId: chapter.id,
        lessonId: lessonIdsByKey[progress.lesson],
        completedAt: progress.completedAt,
        updatedAt: progress.updatedAt,
        quizScore: progress.quizScore ?? null,
        attempts: progress.attempts ?? null,
      });

      if (progress.aiMentor) {
        await aiMentorProgressFactory.create({
          studentLessonProgressId: lessonProgress.id,
          percentage: progress.aiMentor.percentage,
          updatedAt: progress.aiMentor.updatedAt,
        });
      }
    }

    return {
      courseId: course.id,
      learnerIdsByKey,
      adminCookies: await cookieFor(admin, app),
    };
  };

  const requestStatisticsSortedBy = (endpoint: StatisticsEndpoint, sort: string) =>
    request(app.getHttpServer())
      .get(`/api/course/${fixture.courseId}/statistics/${endpoint}`)
      .query({ language: SUPPORTED_LANGUAGES.EN, perPage: 100, sort })
      .set("Cookie", fixture.adminCookies);

  const learnerKeysInOrder = (rows: { studentId: UUIDType }[]) => {
    const learnerKeyById = Object.fromEntries(
      Object.entries(fixture.learnerIdsByKey).map(([learnerKey, learnerId]) => [
        learnerId,
        learnerKey,
      ]),
    );

    return rows.map(({ studentId }) => learnerKeyById[studentId]);
  };

  it.each(STATISTICS_SORT_CASES)(
    "orders $endpoint by $sort",
    async ({ endpoint, sort, expectedLearners }: StatisticsSortCase) => {
      const response = await requestStatisticsSortedBy(endpoint, sort).expect(200);

      expect(learnerKeysInOrder(response.body.data)).toEqual(expectedLearners);
    },
  );

  it("returns each learner's progress with their group and latest completed lesson", async () => {
    const response = await requestStatisticsSortedBy(
      STATISTICS_ENDPOINTS.STUDENTS_PROGRESS,
      "studentName",
    ).expect(200);

    expect(response.body).toMatchObject({
      data: [
        {
          studentId: fixture.learnerIdsByKey[STATISTICS_LEARNERS.ANNA],
          studentName: "Anna Adams",
          groups: [{ name: "Group C" }],
          completedLessonsCount: 1,
          lastActivity: "2025-01-02T10:00:00Z",
          lastCompletedLessonName: LESSON_FIXTURES[STATISTICS_LESSONS.CHARLIE_QUIZ].title,
          studentAvatarUrl: null,
        },
        {
          studentId: fixture.learnerIdsByKey[STATISTICS_LEARNERS.BEN],
          studentName: "Ben Brown",
          groups: [{ name: "Group A" }],
          completedLessonsCount: 2,
          lastActivity: "2025-01-05T10:00:00Z",
          lastCompletedLessonName: LESSON_FIXTURES[STATISTICS_LESSONS.ECHO_MENTOR].title,
          studentAvatarUrl: null,
        },
        {
          studentId: fixture.learnerIdsByKey[STATISTICS_LEARNERS.CARA],
          studentName: "Cara Clark",
          groups: [{ name: "Group B" }],
          completedLessonsCount: 3,
          lastActivity: "2025-01-06T10:00:00Z",
          lastCompletedLessonName: LESSON_FIXTURES[STATISTICS_LESSONS.DELTA_CONTENT].title,
          studentAvatarUrl: null,
        },
      ],
      pagination: { page: 1, perPage: 100, totalItems: 3 },
    });
  });

  it("returns only completed quiz attempts in quiz results", async () => {
    const response = await requestStatisticsSortedBy(
      STATISTICS_ENDPOINTS.STUDENTS_QUIZ_RESULTS,
      "attempts",
    ).expect(200);

    expect(response.body).toMatchObject({
      data: [
        {
          studentId: fixture.learnerIdsByKey[STATISTICS_LEARNERS.ANNA],
          quizName: "Charlie quiz",
          quizScore: 70,
          attempts: 1,
          lastAttempt: "2025-01-07T10:00:00Z",
        },
        {
          studentId: fixture.learnerIdsByKey[STATISTICS_LEARNERS.CARA],
          quizName: "Bravo quiz",
          quizScore: 50,
          attempts: 2,
          lastAttempt: "2025-01-06T10:00:00Z",
        },
        {
          studentId: fixture.learnerIdsByKey[STATISTICS_LEARNERS.BEN],
          quizName: "Alpha quiz",
          quizScore: 90,
          attempts: 3,
          lastAttempt: "2025-01-05T10:00:00Z",
        },
      ],
      pagination: { page: 1, perPage: 100, totalItems: 3 },
    });
  });

  it("returns every AI mentor session, including unfinished ones, in AI mentor results", async () => {
    const response = await requestStatisticsSortedBy(
      STATISTICS_ENDPOINTS.STUDENTS_AI_MENTOR_RESULTS,
      "score",
    ).expect(200);

    expect(response.body).toMatchObject({
      data: [
        {
          studentId: fixture.learnerIdsByKey[STATISTICS_LEARNERS.ANNA],
          lessonName: "Golf mentor",
          score: 40,
          lastSession: "2025-01-08T10:00:00Z",
        },
        {
          studentId: fixture.learnerIdsByKey[STATISTICS_LEARNERS.CARA],
          lessonName: "Foxtrot mentor",
          score: 60,
          lastSession: "2025-01-04T10:00:00Z",
        },
        {
          studentId: fixture.learnerIdsByKey[STATISTICS_LEARNERS.BEN],
          lessonName: "Echo mentor",
          score: 80,
          lastSession: "2025-01-05T10:00:00Z",
        },
      ],
      pagination: { page: 1, perPage: 100, totalItems: 3 },
    });
  });
});
