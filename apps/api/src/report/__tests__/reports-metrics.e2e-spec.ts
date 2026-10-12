import { PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { DB } from "src/storage/db/db.providers";
import {
  assessments,
  assessmentAttempts,
  certificates,
  lessons,
  studentCourses,
  studentLessonProgress,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { ReportsQueryService } from "../reports-query.service";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

describe("Report metric definitions (e2e)", () => {
  let app: INestApplication;
  let service: ReportsQueryService;
  let actor: CurrentUserType;
  let groupId: string;
  let courseId: string;

  beforeAll(async () => {
    const context = await createE2ETest();
    app = context.app;
    const db = app.get<DatabasePg>(DB);
    service = app.get(ReportsQueryService);
    const users = createUserFactory(db);
    const admin = await users.create({ roleSlug: SYSTEM_ROLE_SLUGS.ADMIN });
    const learner = await users.create({ roleSlug: SYSTEM_ROLE_SLUGS.STUDENT });
    const unassigned = await users.create({ roleSlug: SYSTEM_ROLE_SLUGS.STUDENT });
    actor = {
      userId: admin.id,
      tenantId: context.defaultTenantId,
      email: admin.email,
      roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
      permissions: [PERMISSIONS.REPORT_READ, PERMISSIONS.COURSE_UPDATE],
    };
    groupId = (
      await createGroupFactory(db).withMembers([learner.id, unassigned.id, admin.id]).create()
    ).id;
    const courseFactory = createCourseFactory(db);
    const first = await courseFactory.create({ authorId: admin.id });
    const second = await courseFactory.create({ authorId: admin.id });
    courseId = first.id;
    for (const [index, course] of [first, second].entries()) {
      await db.insert(studentCourses).values({
        studentId: learner.id,
        courseId: course.id,
        status: "enrolled",
        progress: "in_progress",
      });
      const chapter = await createChapterFactory(db).create({
        courseId: course.id,
        authorId: admin.id,
      });
      const quizCount = index === 0 ? 2 : 1;
      for (let quiz = 0; quiz < quizCount; quiz++) {
        const [lesson] = await db
          .insert(lessons)
          .values({
            chapterId: chapter.id,
            type: "quiz",
            thresholdScore: 60,
            title: { en: "Quiz" },
          })
          .returning();
        const [assessment] = await db
          .insert(assessments)
          .values({ lessonId: lesson.id, passingScorePercentage: "60" })
          .returning();
        await db.insert(assessmentAttempts).values([
          {
            assessmentId: assessment.id,
            learnerId: learner.id,
            language: "en",
            attemptNumber: 1,
            availablePoints: "100",
            scorePercentage: "10",
            gradingStatus: "graded",
            submissionStatus: "submitted",
            submittedAt: "2026-01-01T10:00:00Z",
            gradedAt: "2026-01-04T10:00:00Z",
          },
          {
            assessmentId: assessment.id,
            learnerId: learner.id,
            language: "en",
            attemptNumber: 2,
            availablePoints: "100",
            scorePercentage: index === 0 ? String(40 + quiz * 40) : "100",
            gradingStatus: "graded",
            submissionStatus: "submitted",
            submittedAt: "2026-01-02T10:00:00Z",
            gradedAt: "2026-01-02T10:00:00Z",
          },
          {
            assessmentId: assessment.id,
            learnerId: learner.id,
            language: "en",
            attemptNumber: 3,
            availablePoints: "100",
            gradingStatus: "pending",
            submissionStatus: "submitted",
            submittedAt: "2026-01-03T10:00:00Z",
          },
          {
            assessmentId: assessment.id,
            learnerId: learner.id,
            language: "en",
            attemptNumber: 4,
            availablePoints: "100",
            gradingStatus: "pending",
            submissionStatus: "in_progress",
            submittedAt: "2026-01-05T10:00:00Z",
          },
        ]);
        if (quiz === 0)
          await db.insert(studentLessonProgress).values({
            studentId: learner.id,
            chapterId: chapter.id,
            lessonId: lesson.id,
            isStarted: true,
            completedAt: "2026-01-02T10:00:00Z",
          });
      }
    }
    await db.insert(certificates).values({
      userId: learner.id,
      courseId: first.id,
      status: "active",
      expiresAt: "2020-01-01T00:00:00Z",
    });
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("weights enrollments equally and selects the latest graded submitted attempt", async () => {
    const result = await service.getReport(
      {
        view: "organisation",
        language: "en",
        timezone: "UTC",
        groupIds: [groupId],
        page: 1,
        pageSize: 25,
      },
      actor,
    );
    expect(result.metrics.learners).toBe(2);
    expect(result.metrics.averageScore).toBe(80);
    expect(result.rows.find((row) => row.course?.id === courseId)).toMatchObject({
      score: 60,
      attempts: 6,
      progress: 50,
      certificate: { status: "expired" },
    });
    expect(result.metrics.activeCertificates).toBe(0);
    expect(result.metrics.certificatesIssued).toBe(1);
  });

  it("counts visible platform courses, leaving out drafts and archived courses", async () => {
    const query = {
      view: "organisation" as const,
      language: "en" as const,
      timezone: "UTC",
      groupIds: [groupId],
      page: 1,
      pageSize: 25,
    };
    const { platformCourses: before } = (await service.getReport(query, actor)).metrics;

    const courseFactory = createCourseFactory(app.get<DatabasePg>(DB));
    await courseFactory.create({ authorId: actor.userId });
    await courseFactory.create({ authorId: actor.userId, status: "draft" });
    await courseFactory.create({ authorId: actor.userId, isArchived: true });

    const { platformCourses: after } = (await service.getReport(query, actor)).metrics;
    expect(before).toBeGreaterThanOrEqual(2);
    expect(after).toBe(before + 1);
  });

  it("excludes learners without learning when a learning condition is active", async () => {
    const result = await service.getReport(
      {
        view: "organisation",
        language: "en",
        timezone: "UTC",
        groupIds: [groupId],
        page: 1,
        pageSize: 25,
        filter: { match: "all", rules: [{ field: "score", operator: "gte", value: 80 }] },
      },
      actor,
    );
    expect(result.metrics.learners).toBe(1);
    expect(result.metrics.courseEnrollments).toBe(1);
    expect(result.metrics.averageScore).toBe(100);
  });
});
