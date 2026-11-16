import {
  ASSESSMENT_FEEDBACK_MODES,
  ASSESSMENT_QUESTION_TYPES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { and, eq } from "drizzle-orm";

import { COURSE_TRANSFER_KINDS } from "src/course-transfer/course-transfer.constants";
import { MasterCourseService } from "src/courses/master-course/master-course.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { QuizAuthoringService } from "src/quiz/services/quiz-authoring.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { chapters, lessons } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import {
  COURSE_SHARING_TABLES,
  createCourseTransferDriver,
  createGlobalSettingsForTenants,
  createSourceCourse,
  exportCourseToTenant,
  findCourseExport,
  prepareSharingTenants,
  signInAsTenantAdmin,
} from "../../../test/helpers/course-sharing";
import { truncateTables } from "../../../test/helpers/test-helpers";

import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type {
  RunAsTenant,
  SharingTenant,
  TenantHttpClient,
} from "../../../test/helpers/course-sharing";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

const FEEDBACK_RANGES = [
  { minPercent: 0, maxPercent: 49, message: "<p>Keep practising {{firstName}}.</p>" },
  { minPercent: 50, maxPercent: 79, message: "<p>Almost there, {{score}}%.</p>" },
  { minPercent: 80, maxPercent: 100, message: "<p>Well done {{firstName}}!</p>" },
];

// Stored ranges also carry their row id.
const rangesMatching = (ranges: Array<Record<string, unknown>>) =>
  ranges.map((range) => expect.objectContaining(range));

describe("Course transfer quiz feedback (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runAsTenant: RunAsTenant;
  let source: SharingTenant;
  let target: SharingTenant;
  let sourceAdmin: UserWithCredentials;
  let sourceHttp: TenantHttpClient;
  let transferDriver: ReturnType<typeof createCourseTransferDriver>;

  beforeAll(async () => {
    const testSetup = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        {
          provide: "CACHE_MANAGER",
          useValue: { get: jest.fn().mockResolvedValue(""), set: jest.fn() },
        },
      ],
    });

    app = testSetup.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runAsTenant = testSetup.runAsTenant;
    ({ source, target } = await prepareSharingTenants(dbAdmin, testSetup.defaultTenantId));
    transferDriver = createCourseTransferDriver(app, dbAdmin);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, COURSE_SHARING_TABLES);
    await createGlobalSettingsForTenants(db, runAsTenant, [source, target]);
    ({ admin: sourceAdmin, http: sourceHttp } = await signInAsTenantAdmin({
      app,
      db,
      runAsTenant,
      tenant: source,
    }));
    await signInAsTenantAdmin({ app, db, runAsTenant, tenant: target });
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, COURSE_SHARING_TABLES);
  });

  const createCourseWithFeedbackQuiz = async () => {
    const { courseId, chapterId } = await createSourceCourse({
      db,
      runAsTenant,
      tenant: source,
      authorId: sourceAdmin.id,
    });
    const quizLesson = await runAsTenant(source.id, () =>
      app.get(QuizAuthoringService).createQuizLesson({
        chapterId,
        title: "Feedback quiz",
        type: LESSON_TYPES.QUIZ,
        thresholdScore: 50,
        attemptsLimit: null,
        quizCooldownInHours: null,
        feedbackMode: ASSESSMENT_FEEDBACK_MODES.SCORE_ONLY,
        feedbackRanges: FEEDBACK_RANGES,
        questions: [
          {
            type: ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE,
            title: "Pick the right one",
            options: [
              { optionText: "Right", isCorrect: true, displayOrder: 1 },
              { optionText: "Wrong", isCorrect: false, displayOrder: 2 },
            ],
          },
        ],
      }),
    );

    return { courseId, quizLessonId: quizLesson.id };
  };

  const readTargetQuizFeedback = (targetCourseId: UUIDType) =>
    runAsTenant(target.id, async () => {
      const [quizLesson] = await db
        .select({ id: lessons.id })
        .from(lessons)
        .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
        .where(and(eq(chapters.courseId, targetCourseId), eq(lessons.type, LESSON_TYPES.QUIZ)));

      if (!quizLesson) throw new Error(`Course ${targetCourseId} has no quiz lesson`);

      const quiz = await app
        .get(QuizAuthoringService)
        .getLegacyQuizLessonForAuthoring(quizLesson.id, SUPPORTED_LANGUAGES.EN);

      return { feedbackMode: quiz?.feedbackMode, feedbackRanges: quiz?.feedbackRanges };
    });

  const syncExportedCourse = async (sourceCourseId: UUIDType) => {
    await runAsTenant(source.id, () =>
      app.get(MasterCourseService).queueSyncForSourceCourse(sourceCourseId, "test"),
    );
    const courseExport = await findCourseExport(dbAdmin, sourceCourseId, target.id);
    const { operation } = await transferDriver.findLatestOperation(
      COURSE_TRANSFER_KINDS.COURSE,
      courseExport.id,
    );

    return transferDriver.transferOperation(operation.id);
  };

  it("carries the feedback mode and every range to the recipient tenant", async () => {
    const { courseId } = await createCourseWithFeedbackQuiz();

    const { targetCourseId } = await exportCourseToTenant(app, sourceHttp, courseId, target);

    if (!targetCourseId) throw new Error("Course was not exported");
    expect(await readTargetQuizFeedback(targetCourseId)).toEqual({
      feedbackMode: ASSESSMENT_FEEDBACK_MODES.SCORE_ONLY,
      feedbackRanges: rangesMatching(FEEDBACK_RANGES),
    });
  });

  it("replaces the recipient ranges and mode when the source quiz changes and syncs again", async () => {
    const { courseId, quizLessonId } = await createCourseWithFeedbackQuiz();
    const { targetCourseId } = await exportCourseToTenant(app, sourceHttp, courseId, target);
    const updatedRanges = [
      { minPercent: 0, maxPercent: 59, message: "<p>Try again.</p>" },
      { minPercent: 60, maxPercent: 100, message: "<p>Passed with {{score}}%.</p>" },
    ];

    await runAsTenant(source.id, () =>
      app.get(QuizAuthoringService).updateQuizLesson(quizLessonId, {
        language: SUPPORTED_LANGUAGES.EN,
        feedbackMode: ASSESSMENT_FEEDBACK_MODES.FULL,
        feedbackRanges: updatedRanges,
      }),
    );
    await syncExportedCourse(courseId);

    if (!targetCourseId) throw new Error("Course was not exported");
    expect(await readTargetQuizFeedback(targetCourseId)).toEqual({
      feedbackMode: ASSESSMENT_FEEDBACK_MODES.FULL,
      feedbackRanges: rangesMatching(updatedRanges),
    });
  });
});
