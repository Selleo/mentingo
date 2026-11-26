import { LESSON_TYPES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";

import { FileService } from "src/file/file.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  aiJudgeConfigurations,
  aiMentorJudgements,
  assessmentAttempts,
  lessons,
  scormPackages,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createConfiguredAiMentorLessonFactory } from "../../../test/factory/ai-mentor-lesson.factory";
import {
  createAiMentorJudgementFactory,
  createAiMentorThreadFactory,
} from "../../../test/factory/ai-mentor-thread.factory";
import { createAssessmentAttemptFactory } from "../../../test/factory/assessment-attempt.factory";
import { createScormPackageFactory } from "../../../test/factory/scorm-package.factory";
import {
  LESSON_TABLES,
  createCacheManagerMock,
  createFileServiceMock,
  createLessonHelpers,
  resetCacheManagerMock,
  resetFileServiceMock,
} from "../../../test/helpers/lesson";
import { truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { LessonTypes } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { SignedInUser } from "test/helpers/course-enrollment";

const fileServiceMock = createFileServiceMock();
const cacheManagerMock = createCacheManagerMock();

describe("Lesson deletion (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let helpers: ReturnType<typeof createLessonHelpers>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        { provide: FileService, useValue: fileServiceMock },
        { provide: "CACHE_MANAGER", useValue: cacheManagerMock },
      ],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    helpers = createLessonHelpers({ app, db, runInTenant });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, LESSON_TABLES);
    resetFileServiceMock(fileServiceMock);
    resetCacheManagerMock(cacheManagerMock);
    await helpers.arrangeGlobalSettings();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, LESSON_TABLES);
  });

  const arrangeAdminLesson = async (type: LessonTypes, thresholdScore: number | null = null) => {
    const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
    const course = await helpers.arrangeCourse({ authorId: admin.user.id });
    const chapter = await helpers.arrangeChapter(course.id, { authorId: admin.user.id });
    const lesson = await helpers.arrangeLesson(chapter.id, {
      type,
      thresholdScore,
      displayOrder: 0,
    });

    return { admin, lesson };
  };

  const deleteLesson = (admin: SignedInUser, lessonId: UUIDType) =>
    request(app.getHttpServer())
      .delete("/api/lesson")
      .query({ lessonId })
      .set("Cookie", admin.cookies)
      .expect(200);

  const countRows = (rows: () => Promise<unknown[]>) =>
    runInTenant(async () => (await rows()).length);

  describe("DELETE /api/lesson", () => {
    it("deletes a quiz lesson together with its attempts", async () => {
      const { admin, lesson } = await arrangeAdminLesson(LESSON_TYPES.QUIZ, 70);
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const attempt = await runInTenant(() =>
        createAssessmentAttemptFactory(db).create({ lessonId: lesson.id, learnerId: learner.id }),
      );

      const response = await deleteLesson(admin, lesson.id);

      expect(response.body.data).toEqual({
        message: "adminCourseView.curriculum.lesson.toast.lessonDeletedSuccessfully",
      });
      expect(
        await countRows(() => db.select().from(lessons).where(eq(lessons.id, lesson.id))),
      ).toBe(0);
      expect(
        await countRows(() =>
          db
            .select()
            .from(assessmentAttempts)
            .where(eq(assessmentAttempts.assessmentId, attempt.assessmentId)),
        ),
      ).toBe(0);
    });

    it("removes the package of a SCORM lesson", async () => {
      const { admin, lesson } = await arrangeAdminLesson(LESSON_TYPES.SCORM);
      const scormPackage = await runInTenant(() =>
        createScormPackageFactory(db).create({ entityId: lesson.id }),
      );

      await deleteLesson(admin, lesson.id);

      expect(
        await countRows(() =>
          db.select().from(scormPackages).where(eq(scormPackages.id, scormPackage.id)),
        ),
      ).toBe(0);
    });

    it("deletes an AI mentor lesson with a completed judgement", async () => {
      const { admin, lesson } = await arrangeAdminLesson(LESSON_TYPES.AI_MENTOR);
      const judgement = await runInTenant(async () => {
        const aiMentorLesson = await createConfiguredAiMentorLessonFactory(db).create({
          lessonId: lesson.id,
        });
        const [judgeConfiguration] = await db
          .select({ id: aiJudgeConfigurations.id })
          .from(aiJudgeConfigurations)
          .where(eq(aiJudgeConfigurations.aiMentorLessonId, aiMentorLesson.id));
        const thread = await createAiMentorThreadFactory(db).create({
          userId: admin.user.id,
          aiMentorLessonId: aiMentorLesson.id,
        });

        return createAiMentorJudgementFactory(db).create({
          threadId: thread.id,
          configurationId: judgeConfiguration.id,
        });
      });

      await deleteLesson(admin, lesson.id);

      expect(
        await countRows(() =>
          db.select().from(aiMentorJudgements).where(eq(aiMentorJudgements.id, judgement.id)),
        ),
      ).toBe(0);
    });
  });
});
