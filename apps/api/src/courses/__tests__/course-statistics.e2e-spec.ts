import {
  COURSE_ENROLLMENT,
  COURSE_PROGRESS_STATUSES,
  LESSON_TYPES,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { users } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseSummaryStatsFactory } from "../../../test/factory/course-summary-stats.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupManagerGroupFactory } from "../../../test/factory/group-course.factory";
import { createLearningTimeFactory } from "../../../test/factory/learning-time.factory";
import { createLessonFactory } from "../../../test/factory/lesson.factory";
import { createStudentCourseFactory } from "../../../test/factory/student-course.factory";
import { createStudentLessonProgressFactory } from "../../../test/factory/student-lesson-progress.factory";
import {
  COURSE_ENROLLMENT_TABLES,
  createCourseEnrollmentHelpers,
} from "../../../test/helpers/course-enrollment";
import { assignSystemRoleToUserInTests } from "../../../test/helpers/permission-role-helpers";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import {
  AVERAGE_QUIZ_SCORE_CASES,
  QUIZ_GROUP_FILTERS,
  QUIZ_LEARNERS,
  QUIZ_RESULTS,
  QUIZZES,
  STATISTICS_ACCESS_CASES,
  STATISTICS_VIEWERS,
} from "./course-statistics.scenarios";

import type {
  Quiz,
  QuizGroupFilter,
  QuizLearner,
  StatisticsViewer,
} from "./course-statistics.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { SignedInUser } from "test/helpers/course-enrollment";

export const COURSE_STATISTICS_TABLES: Parameters<typeof truncateTables>[1] = [
  ...COURSE_ENROLLMENT_TABLES,
  "lesson_learning_time",
  "courses_summary_stats",
  "group_manager_groups",
];

const cacheManagerMock = {
  get: jest.fn(),
  set: jest.fn(),
};

type StatisticsQuery = { groupId?: UUIDType; search?: string };

const LEARNING_SECONDS_PER_QUIZ = 120;

const idOf = <Key extends string>(ids: Map<Key, UUIDType>, key: Key) => {
  const id = ids.get(key);
  if (!id) throw new Error(`No id was arranged for ${key}`);

  return id;
};

describe("Course statistics (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let helpers: ReturnType<typeof createCourseEnrollmentHelpers>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [{ provide: "CACHE_MANAGER", useValue: cacheManagerMock }],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    helpers = createCourseEnrollmentHelpers({ app, db, runInTenant });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, COURSE_STATISTICS_TABLES);

    Object.values(cacheManagerMock).forEach((mock) => mock.mockReset());
    cacheManagerMock.get.mockResolvedValue("");
    cacheManagerMock.set.mockResolvedValue("");

    await helpers.arrangeGlobalSettings();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, COURSE_STATISTICS_TABLES);
  });

  const getStatistics = (
    viewer: SignedInUser,
    courseId: UUIDType,
    path: string,
    query: Record<string, string | number> = {},
    expectedStatus = 200,
  ) =>
    request(app.getHttpServer())
      .get(`/api/course/${courseId}/statistics${path}`)
      .query(query)
      .set("Cookie", viewer.cookies)
      .expect(expectedStatus);

  const getAverageQuizScores = async (
    viewer: SignedInUser,
    courseId: UUIDType,
    query: StatisticsQuery = {},
  ) => {
    const response = await getStatistics(viewer, courseId, "/average-quiz-score", {
      language: SUPPORTED_LANGUAGES.EN,
      ...query,
    });

    return response.body.data.averageScoresPerQuiz;
  };

  const getAllStatistics = async (
    viewer: SignedInUser,
    courseId: UUIDType,
    query: StatisticsQuery = {},
  ) => {
    const listQuery = { language: SUPPORTED_LANGUAGES.EN, perPage: 100, ...query };
    const [summary, progress, quizResults, aiMentorResults, learningTime] = await Promise.all([
      getStatistics(viewer, courseId, "", query),
      getStatistics(viewer, courseId, "/students-progress", listQuery),
      getStatistics(viewer, courseId, "/students-quiz-results", listQuery),
      getStatistics(viewer, courseId, "/students-ai-mentor-results", listQuery),
      getStatistics(viewer, courseId, "/learning-time", { perPage: 100, ...query }),
    ]);

    return {
      summary: summary.body.data,
      progress: progress.body.data,
      quizResults: quizResults.body.data,
      aiMentorResults: aiMentorResults.body.data,
      averageScoresPerQuiz: await getAverageQuizScores(viewer, courseId, query),
      learningTimeUsers: learningTime.body.data.users,
    };
  };

  const arrangeQuizCourse = (authorId: UUIDType, quizzes: Quiz[]) =>
    runInTenant(async () => {
      const course = await createCourseFactory(db).create({ authorId, chapterCount: 1 });
      const chapter = await createChapterFactory(db).create({
        authorId,
        courseId: course.id,
        displayOrder: 1,
        lessonCount: quizzes.length,
      });
      const quizLessons = new Map<Quiz, UUIDType>();

      for (const [quizIndex, quiz] of quizzes.entries()) {
        const lesson = await createLessonFactory(db).create({
          chapterId: chapter.id,
          type: LESSON_TYPES.QUIZ,
          title: { [SUPPORTED_LANGUAGES.EN]: quiz },
          thresholdScore: 0,
          displayOrder: quizIndex + 1,
        });
        quizLessons.set(quiz, lesson.id);
      }

      return { course, chapter, quizLessons };
    });

  const arrangeCompletedQuiz = ({
    learnerId,
    courseId,
    chapterId,
    lessonId,
    quizScore,
  }: {
    learnerId: UUIDType;
    courseId: UUIDType;
    chapterId: UUIDType;
    lessonId: UUIDType;
    quizScore: number;
  }) =>
    runInTenant(async () => {
      await createStudentLessonProgressFactory(db).create({
        studentId: learnerId,
        chapterId,
        lessonId,
        quizScore,
        attempts: 1,
        isQuizPassed: true,
      });
      await createLearningTimeFactory(db).create({
        userId: learnerId,
        lessonId,
        courseId,
        totalSeconds: LEARNING_SECONDS_PER_QUIZ,
      });
    });

  const arrangeCompletedEnrollment = (learnerId: UUIDType, courseId: UUIDType) =>
    runInTenant(() =>
      createStudentCourseFactory(db).create({
        studentId: learnerId,
        courseId,
        progress: COURSE_PROGRESS_STATUSES.COMPLETED,
        completedAt: new Date().toISOString(),
        finishedChapterCount: 1,
      }),
    );

  const arrangeCourseSummaryStats = (courseId: UUIDType, authorId: UUIDType) =>
    runInTenant(() =>
      createCourseSummaryStatsFactory(db).create({
        courseId,
        authorId,
        freePurchasedCount: 1,
        completedCourseStudentCount: 1,
      }),
    );

  const markUserDeleted = (userId: UUIDType) =>
    runInTenant(() =>
      db.update(users).set({ deletedAt: new Date().toISOString() }).where(eq(users.id, userId)),
    );

  describe("GET /api/course/:courseId/statistics/average-quiz-score", () => {
    const arrangeStatisticsViewer = async (
      viewer: StatisticsViewer,
    ): Promise<{ viewer: SignedInUser; courseAuthorId: UUIDType }> =>
      match(viewer)
        .with(STATISTICS_VIEWERS.COURSE_AUTHOR, async () => {
          const author = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);

          return { viewer: author, courseAuthorId: author.user.id };
        })
        .with(STATISTICS_VIEWERS.OTHER_CONTENT_CREATOR, async () => ({
          viewer: await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR),
          courseAuthorId: (await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR)).id,
        }))
        .with(STATISTICS_VIEWERS.ADMIN, async () => ({
          viewer: await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN),
          courseAuthorId: (await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR)).id,
        }))
        .exhaustive();

    it.each(STATISTICS_ACCESS_CASES)(
      "responds with $expectedStatus to $viewer",
      async ({ viewer, expectedStatus, expectedBody }) => {
        const { viewer: signedInViewer, courseAuthorId } = await arrangeStatisticsViewer(viewer);
        const { course } = await arrangeQuizCourse(courseAuthorId, []);

        const response = await getStatistics(
          signedInViewer,
          course.id,
          "/average-quiz-score",
          { language: SUPPORTED_LANGUAGES.EN },
          expectedStatus,
        );

        expect(response.body).toMatchObject(expectedBody);
      },
    );

    const arrangeQuizScoreCourse = async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const { course, chapter, quizLessons } = await arrangeQuizCourse(
        admin.user.id,
        Object.values(QUIZZES),
      );
      const learnerIds = new Map<QuizLearner, UUIDType>();

      for (const learner of Object.values(QUIZ_LEARNERS)) {
        const { id } = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
        const status = match(learner)
          .with(QUIZ_LEARNERS.UNENROLLED, () => COURSE_ENROLLMENT.NOT_ENROLLED)
          .otherwise(() => COURSE_ENROLLMENT.ENROLLED);

        await runInTenant(() =>
          createStudentCourseFactory(db).create({ studentId: id, courseId: course.id, status }),
        );
        learnerIds.set(learner, id);
      }

      for (const { learner, quiz, quizScore } of QUIZ_RESULTS) {
        await arrangeCompletedQuiz({
          learnerId: idOf(learnerIds, learner),
          courseId: course.id,
          chapterId: chapter.id,
          lessonId: idOf(quizLessons, quiz),
          quizScore,
        });
      }

      await markUserDeleted(idOf(learnerIds, QUIZ_LEARNERS.DELETED));

      return { admin, course, quizLessons, learnerIds };
    };

    const arrangeGroupFilter = async (
      groupFilter: QuizGroupFilter,
      learnerIds: Map<QuizLearner, UUIDType>,
    ): Promise<StatisticsQuery> =>
      match(groupFilter)
        .with(QUIZ_GROUP_FILTERS.NONE, async () => ({}))
        .with(QUIZ_GROUP_FILTERS.MEMBER_GROUP, async () => {
          const group = await helpers.arrangeGroupWithMembers([
            idOf(learnerIds, QUIZ_LEARNERS.GROUP_MEMBER),
          ]);

          return { groupId: group.id };
        })
        .with(QUIZ_GROUP_FILTERS.EMPTY_GROUP, async () => {
          const group = await helpers.arrangeGroupWithMembers([]);

          return { groupId: group.id };
        })
        .exhaustive();

    it.each(AVERAGE_QUIZ_SCORE_CASES)(
      "averages active enrolled learners' scores with $groupFilter",
      async ({ groupFilter, expectedAverages }) => {
        const { admin, course, quizLessons, learnerIds } = await arrangeQuizScoreCourse();
        const query = await arrangeGroupFilter(groupFilter, learnerIds);

        const averageScoresPerQuiz = await getAverageQuizScores(admin, course.id, query);

        expect(averageScoresPerQuiz).toEqual(
          expectedAverages.map(({ quiz, ...average }) => ({
            quizId: quizLessons.get(quiz),
            name: quiz,
            ...average,
          })),
        );
      },
    );
  });

  describe("statistics of a deleted learner", () => {
    const arrangeLearnerWithCompletedCourse = async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { course, chapter, quizLessons } = await arrangeQuizCourse(admin.user.id, [
        QUIZZES.FIRST,
      ]);
      const quizId = idOf(quizLessons, QUIZZES.FIRST);

      await arrangeCourseSummaryStats(course.id, admin.user.id);
      await arrangeCompletedEnrollment(learner.id, course.id);
      await arrangeCompletedQuiz({
        learnerId: learner.id,
        courseId: course.id,
        chapterId: chapter.id,
        lessonId: quizId,
        quizScore: 80,
      });
      const group = await helpers.arrangeGroupWithMembers([learner.id]);

      return { admin, learner, course, quizId, group };
    };

    it("finds a learner by a partial full name", async () => {
      const { admin, learner, course, quizId, group } = await arrangeLearnerWithCompletedCourse();

      const statistics = await getAllStatistics(admin, course.id, {
        search: `${learner.firstName} ${learner.lastName.slice(0, 1)}`,
      });

      expect(statistics).toMatchObject({
        progress: [{ studentId: learner.id }],
        quizResults: [{ studentId: learner.id, lessonId: quizId, quizScore: 80 }],
        learningTimeUsers: [{ id: learner.id, groups: [{ id: group.id, name: group.name }] }],
      });
    });

    it("excludes the learner from every statistics endpoint after deletion", async () => {
      const { admin, learner, course } = await arrangeLearnerWithCompletedCourse();

      await request(app.getHttpServer())
        .delete("/api/user")
        .send({ userIds: [learner.id] })
        .set("Cookie", admin.cookies)
        .expect(200);

      expect(await getAllStatistics(admin, course.id)).toEqual({
        summary: expect.objectContaining({
          enrolledCount: 0,
          completionPercentage: 0,
          averageCompletionPercentage: 0,
          averageSeconds: 0,
        }),
        progress: [],
        quizResults: [],
        aiMentorResults: [],
        averageScoresPerQuiz: [],
        learningTimeUsers: [],
      });
    });
  });

  describe("statistics of a group manager", () => {
    const arrangeSignedInGroupManager = async (): Promise<SignedInUser> => {
      const manager = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      await runInTenant(() =>
        assignSystemRoleToUserInTests(
          db,
          manager.id,
          manager.tenantId,
          SYSTEM_ROLE_SLUGS.GROUP_MANAGER,
        ),
      );

      return { user: manager, cookies: await cookieFor(manager, app) };
    };

    const arrangeManagedAndUnmanagedLearners = async () => {
      const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const manager = await arrangeSignedInGroupManager();
      const managedLearner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const unmanagedLearner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { course, chapter, quizLessons } = await arrangeQuizCourse(admin.id, [QUIZZES.FIRST]);
      const managedGroup = await helpers.arrangeGroupWithMembers([managedLearner.id]);
      const unmanagedGroup = await helpers.arrangeGroupWithMembers([unmanagedLearner.id]);

      await runInTenant(() =>
        createGroupManagerGroupFactory(db).create({
          managerUserId: manager.user.id,
          groupId: managedGroup.id,
        }),
      );
      await arrangeCourseSummaryStats(course.id, admin.id);

      for (const [learner, quizScore] of [
        [managedLearner, 80],
        [unmanagedLearner, 20],
      ] as const) {
        await arrangeCompletedEnrollment(learner.id, course.id);
        await arrangeCompletedQuiz({
          learnerId: learner.id,
          courseId: course.id,
          chapterId: chapter.id,
          lessonId: idOf(quizLessons, QUIZZES.FIRST),
          quizScore,
        });
      }

      return { manager, managedLearner, course, unmanagedGroup };
    };

    it("limits every statistics endpoint to learners of the managed groups", async () => {
      const { manager, managedLearner, course } = await arrangeManagedAndUnmanagedLearners();

      expect(await getAllStatistics(manager, course.id)).toMatchObject({
        summary: { enrolledCount: 1 },
        progress: [{ studentId: managedLearner.id }],
        quizResults: [{ studentId: managedLearner.id }],
        aiMentorResults: [],
        averageScoresPerQuiz: [{ averageScore: 80 }],
        learningTimeUsers: [{ id: managedLearner.id }],
      });
    });

    it("rejects filtering by a group the manager does not manage", async () => {
      const { manager, course, unmanagedGroup } = await arrangeManagedAndUnmanagedLearners();

      await getStatistics(
        manager,
        course.id,
        "/students-progress",
        { language: SUPPORTED_LANGUAGES.EN, groupId: unmanagedGroup.id },
        404,
      );
    });
  });
});
