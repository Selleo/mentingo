import {
  CERTIFICATE_ARCHIVE_REASONS,
  CERTIFICATE_STATUSES,
  COURSE_CERTIFICATE_STATUSES,
  COURSE_ENROLLMENT,
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_PARTICIPANT_ROLES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { and, eq, isNull } from "drizzle-orm";
import readXlsxFile from "read-excel-file/node";
import request from "supertest";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { FileService } from "src/file/file.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { QUESTION_TYPE } from "src/questions/schema/question.types";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  aiMentorStudentLessonProgress,
  certificates,
  chapters,
  courses,
  coursesSummaryStats,
  groupManagerGroups,
  groupUsers,
  lessons,
  lessonLearningTime,
  liveTrainingAttendance,
  liveTrainingSessionParticipants,
  liveTrainingSessions,
  permissionUserRoles,
  questions,
  settings,
  studentCourses,
  studentLearningPaths,
  studentLessonProgress,
  userDetails,
} from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import { createE2ETest } from "../../../../test/create-e2e-test";
import { createCourseFactory } from "../../../../test/factory/course.factory";
import { createGroupFactory } from "../../../../test/factory/group.factory";
import { createLearningPathFactory } from "../../../../test/factory/learningPath.factory";
import { createSettingsFactory } from "../../../../test/factory/settings.factory";
import { createUserFactory } from "../../../../test/factory/user.factory";
import { DEFAULT_E2E_GLOBAL_SETTINGS } from "../../../../test/helpers/e2e-settings";
import { addSystemRoleToUserInTests } from "../../../../test/helpers/permission-role-helpers";
import { cookieFor, truncateAllTables } from "../../../../test/helpers/test-helpers";

import type { CourseTest } from "../../../../test/factory/course.factory";
import type { UserWithCredentials } from "../../../../test/factory/user.factory";
import type { INestApplication } from "@nestjs/common";
import type { SystemRoleSlug } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { ProgressStatus } from "src/utils/types/progress.type";

type Fixture = {
  admin: UserWithCredentials;
  manager: UserWithCredentials;
  assignedLearner: UserWithCredentials;
  outsideLearner: UserWithCredentials;
  assignedGroupId: UUIDType;
  outsideGroupId: UUIDType;
  visibleCourse: CourseTest;
  hiddenCourse: CourseTest;
  visibleLessonId: UUIDType;
};

describe("Group Manager authorization outcomes (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let defaultTenantId: UUIDType;
  let fixture: Fixture;
  let userFactory: ReturnType<typeof createUserFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let learningPathFactory: ReturnType<typeof createLearningPathFactory>;
  let fileServiceMock: {
    getFileUrl: jest.Mock;
    getResourcesForEntity: jest.Mock;
  };

  const password = "password123";

  const createUser = async (
    prefix: string,
    roleSlug: SystemRoleSlug = SYSTEM_ROLE_SLUGS.STUDENT,
  ): Promise<UserWithCredentials> => {
    const user = await userFactory.withCredentials({ password }).create({
      email: `${prefix}-${crypto.randomUUID()}@example.com`,
      tenantId: defaultTenantId,
      roleSlug,
    });
    await createSettingsFactory(db, user.id, roleSlug === SYSTEM_ROLE_SLUGS.ADMIN).create();
    return user;
  };

  const enroll = async (
    learnerId: UUIDType,
    courseId: UUIDType,
    progress: ProgressStatus = PROGRESS_STATUSES.NOT_STARTED,
  ) => {
    await db.insert(studentCourses).values({
      studentId: learnerId,
      courseId,
      status: COURSE_ENROLLMENT.ENROLLED,
      progress,
    });
  };

  const assignManagedGroup = async (managerId: UUIDType, groupId: UUIDType) => {
    await db.insert(groupManagerGroups).values({
      managerUserId: managerId,
      groupId,
      tenantId: defaultTenantId,
    });
  };

  const createBaseFixture = async (): Promise<Fixture> => {
    const admin = await createUser("admin", SYSTEM_ROLE_SLUGS.ADMIN);
    const manager = await createUser("manager", SYSTEM_ROLE_SLUGS.GROUP_MANAGER);
    const assignedLearner = await createUser("assigned");
    const outsideLearner = await createUser("outside");

    const assignedGroup = await groupFactory.withMembers([assignedLearner.id]).create({
      name: "Managed team",
      tenantId: defaultTenantId,
    });
    const outsideGroup = await groupFactory.withMembers([outsideLearner.id]).create({
      name: "Outside team",
      tenantId: defaultTenantId,
    });
    await assignManagedGroup(manager.id, assignedGroup.id);

    const visibleCourse = await courseFactory.create({
      authorId: admin.id,
      title: "Visible course",
      hasCertificate: true,
    });
    const hiddenCourse = await courseFactory.create({
      authorId: admin.id,
      title: "Hidden course",
      hasCertificate: true,
    });

    await enroll(assignedLearner.id, visibleCourse.id, PROGRESS_STATUSES.IN_PROGRESS);
    await enroll(outsideLearner.id, visibleCourse.id, PROGRESS_STATUSES.COMPLETED);
    await enroll(outsideLearner.id, hiddenCourse.id, PROGRESS_STATUSES.IN_PROGRESS);

    await db.insert(coursesSummaryStats).values([
      { courseId: visibleCourse.id, authorId: admin.id },
      { courseId: hiddenCourse.id, authorId: admin.id },
    ]);

    const [chapter] = await db
      .insert(chapters)
      .values({
        title: buildJsonbField("en", "Preview chapter"),
        courseId: visibleCourse.id,
        authorId: admin.id,
        displayOrder: 1,
        lessonCount: 1,
      })
      .returning();
    const [lesson] = await db
      .insert(lessons)
      .values({
        title: buildJsonbField("en", "Preview lesson"),
        description: buildJsonbField("en", "Manager-readable content"),
        chapterId: chapter.id,
        type: LESSON_TYPES.CONTENT,
        displayOrder: 1,
      })
      .returning();

    return {
      admin,
      manager,
      assignedLearner,
      outsideLearner,
      assignedGroupId: assignedGroup.id,
      outsideGroupId: outsideGroup.id,
      visibleCourse,
      hiddenCourse,
      visibleLessonId: lesson.id,
    };
  };

  beforeAll(async () => {
    fileServiceMock = {
      getFileUrl: jest.fn().mockResolvedValue("https://example.test/file"),
      getResourcesForEntity: jest.fn().mockResolvedValue([]),
    };
    const testContext = await createE2ETest({
      customProviders: [
        {
          provide: FileService,
          useValue: fileServiceMock,
        },
      ],
    });
    app = testContext.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    defaultTenantId = testContext.defaultTenantId;
    userFactory = createUserFactory(db);
    groupFactory = createGroupFactory(db);
    courseFactory = createCourseFactory(db);
    learningPathFactory = createLearningPathFactory(db);
  }, 60_000);

  beforeEach(async () => {
    fileServiceMock.getFileUrl.mockClear();
    fixture = await createBaseFixture();
  });

  afterEach(async () => {
    await truncateAllTables(dbAdmin, db);
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated and non-manager access", async () => {
    await request(app.getHttpServer())
      .get(`/api/certificates/course/${fixture.visibleCourse.id}?language=en`)
      .expect(401);

    const studentCookie = await cookieFor(fixture.assignedLearner, app);
    await request(app.getHttpServer())
      .get(`/api/certificates/course/${fixture.visibleCourse.id}?language=en`)
      .set("Cookie", studentCookie)
      .expect(403);
  });

  it("allows an account with no managed groups but returns no derived access", async () => {
    const managerWithoutGroups = await createUser("empty-manager", SYSTEM_ROLE_SLUGS.GROUP_MANAGER);
    const cookie = await cookieFor(managerWithoutGroups, app);

    const coursesResponse = await request(app.getHttpServer())
      .get("/api/course/all?language=en&page=1&perPage=20")
      .set("Cookie", cookie)
      .expect(200);
    expect(coursesResponse.body.data).toEqual([]);

    const dashboardResponse = await request(app.getHttpServer())
      .get("/api/statistics/dashboard/training-completion")
      .set("Cookie", cookie)
      .expect(200);
    expect(dashboardResponse.body.data).toMatchObject({ completed: 0, total: 0 });

    await request(app.getHttpServer())
      .get(`/api/course/${fixture.visibleCourse.id}/statistics`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns only courses and learner results in the current managed scope", async () => {
    const cookie = await cookieFor(fixture.manager, app);

    const coursesResponse = await request(app.getHttpServer())
      .get("/api/course/all?language=en&page=1&perPage=20")
      .set("Cookie", cookie)
      .expect(200);
    expect(coursesResponse.body.data.map(({ id }: { id: string }) => id)).toEqual([
      fixture.visibleCourse.id,
    ]);

    const statsResponse = await request(app.getHttpServer())
      .get(`/api/course/${fixture.visibleCourse.id}/statistics`)
      .set("Cookie", cookie)
      .expect(200);
    expect(statsResponse.body.data.enrolledCount).toBe(1);

    const progressResponse = await request(app.getHttpServer())
      .get(`/api/course/${fixture.visibleCourse.id}/statistics/students-progress`)
      .query({ page: 1, perPage: 20, language: "en" })
      .set("Cookie", cookie)
      .expect(200);
    expect(progressResponse.body.data).toHaveLength(1);
    expect(progressResponse.body.data[0].studentEmail).toBe(fixture.assignedLearner.email);
    expect(JSON.stringify(progressResponse.body.data[0])).not.toContain(fixture.outsideGroupId);

    const dashboardResponse = await request(app.getHttpServer())
      .get("/api/statistics/dashboard/training-completion")
      .set("Cookie", cookie)
      .expect(200);
    expect(dashboardResponse.body.data).toMatchObject({ completed: 0, total: 1 });

    await request(app.getHttpServer())
      .get("/api/statistics/dashboard/deadline-risks")
      .query({ language: "en", type: "overdue", page: 1, perPage: 20 })
      .set("Cookie", cookie)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/statistics/dashboard/deadline-risks/courses/${fixture.visibleCourse.id}/groups`)
      .query({ language: "en", page: 1, perPage: 20 })
      .set("Cookie", cookie)
      .expect(200);
  });

  it("allows course author details only for courses in the managed scope", async () => {
    const visibleAuthor = await createUser("visible-author", SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
    const hiddenAuthor = await createUser("hidden-author", SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
    const visibleAuthoredCourse = await courseFactory.create({ authorId: visibleAuthor.id });
    const hiddenAuthoredCourse = await courseFactory.create({ authorId: hiddenAuthor.id });
    await enroll(fixture.assignedLearner.id, visibleAuthoredCourse.id);
    await enroll(fixture.outsideLearner.id, hiddenAuthoredCourse.id);
    await db.insert(userDetails).values({
      userId: visibleAuthor.id,
      tenantId: defaultTenantId,
      contactEmail: "private-author@example.com",
      contactPhoneNumber: "123456789",
    });

    const cookie = await cookieFor(fixture.manager, app);

    const visibleResponse = await request(app.getHttpServer())
      .get(`/api/user/details?userId=${visibleAuthor.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(visibleResponse.body.data.id).toBe(visibleAuthor.id);
    expect(visibleResponse.body.data.contactEmail).toBeNull();
    expect(visibleResponse.body.data.contactPhone).toBeNull();

    await request(app.getHttpServer())
      .get(`/api/user/details?userId=${hiddenAuthor.id}`)
      .set("Cookie", cookie)
      .expect(403);
  });

  it("includes individually enrolled progress once the learner is in a managed group", async () => {
    const cookie = await cookieFor(fixture.manager, app);

    const [enrollment] = await db
      .select({ enrolledByGroupId: studentCourses.enrolledByGroupId })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.studentId, fixture.assignedLearner.id),
          eq(studentCourses.courseId, fixture.visibleCourse.id),
        ),
      );
    expect(enrollment.enrolledByGroupId).toBeNull();

    const response = await request(app.getHttpServer())
      .get(`/api/course/${fixture.visibleCourse.id}/statistics/students-progress`)
      .query({ page: 1, perPage: 20, language: "en" })
      .set("Cookie", cookie)
      .expect(200);
    expect(
      response.body.data.map(({ studentEmail }: { studentEmail: string }) => studentEmail),
    ).toEqual([fixture.assignedLearner.email]);
  });

  it("averages learning time across all scoped enrollments including learners with no time", async () => {
    const notStartedLearner = await createUser("not-started");
    await db.insert(groupUsers).values({
      groupId: fixture.assignedGroupId,
      userId: notStartedLearner.id,
    });
    await groupFactory.withMembers([fixture.assignedLearner.id]).create({
      name: "Additional learner group",
      tenantId: defaultTenantId,
    });
    await enroll(notStartedLearner.id, fixture.visibleCourse.id);
    await db.insert(lessonLearningTime).values({
      userId: fixture.assignedLearner.id,
      lessonId: fixture.visibleLessonId,
      courseId: fixture.visibleCourse.id,
      totalSeconds: 120,
    });

    const cookie = await cookieFor(fixture.manager, app);
    const response = await request(app.getHttpServer())
      .get(`/api/course/${fixture.visibleCourse.id}/statistics`)
      .set("Cookie", cookie)
      .expect(200);

    expect(response.body.data.enrolledCount).toBe(2);
    expect(response.body.data.averageSeconds).toBe(60);

    const learningTimeResponse = await request(app.getHttpServer())
      .get(`/api/course/${fixture.visibleCourse.id}/statistics/learning-time`)
      .query({ page: 1, perPage: 20 })
      .set("Cookie", cookie)
      .expect(200);

    expect(learningTimeResponse.body.data.users).toEqual([
      expect.objectContaining({
        id: fixture.assignedLearner.id,
        totalSeconds: 120,
      }),
    ]);
  });

  it("scopes quiz and AI Mentor outcomes to authorized learners", async () => {
    const [chapter] = await db
      .select({ id: chapters.id })
      .from(chapters)
      .where(eq(chapters.courseId, fixture.visibleCourse.id));
    const completedAt = new Date().toISOString();
    const [quizLesson] = await db
      .insert(lessons)
      .values({
        title: buildJsonbField("en", "Quiz assessment"),
        chapterId: chapter.id,
        type: LESSON_TYPES.QUIZ,
        thresholdScore: 70,
        displayOrder: 2,
      })
      .returning();
    await db.insert(studentLessonProgress).values([
      {
        studentId: fixture.assignedLearner.id,
        chapterId: chapter.id,
        lessonId: quizLesson.id,
        attempts: 1,
        quizScore: 85,
        completedAt,
      },
      {
        studentId: fixture.outsideLearner.id,
        chapterId: chapter.id,
        lessonId: quizLesson.id,
        attempts: 2,
        quizScore: 40,
        completedAt,
      },
    ]);
    const [unansweredQuestion] = await db
      .insert(questions)
      .values({
        lessonId: quizLesson.id,
        authorId: fixture.admin.id,
        type: QUESTION_TYPE.DETAILED_RESPONSE,
        title: buildJsonbField("en", "Explain your answer"),
        displayOrder: 1,
      })
      .returning();

    const [aiLesson] = await db
      .insert(lessons)
      .values({
        title: buildJsonbField("en", "AI Mentor assessment"),
        chapterId: chapter.id,
        type: LESSON_TYPES.AI_MENTOR,
        displayOrder: 3,
      })
      .returning();
    const aiProgress = await db
      .insert(studentLessonProgress)
      .values([
        {
          studentId: fixture.assignedLearner.id,
          chapterId: chapter.id,
          lessonId: aiLesson.id,
          completedAt,
        },
        {
          studentId: fixture.outsideLearner.id,
          chapterId: chapter.id,
          lessonId: aiLesson.id,
          completedAt,
        },
      ])
      .returning();
    await db.insert(aiMentorStudentLessonProgress).values([
      { studentLessonProgressId: aiProgress[0].id, percentage: 90 },
      { studentLessonProgressId: aiProgress[1].id, percentage: 30 },
    ]);
    const overlappingGroup = await groupFactory.withMembers([fixture.assignedLearner.id]).create({
      name: "Overlapping assessment team",
      tenantId: defaultTenantId,
    });
    await assignManagedGroup(fixture.manager.id, overlappingGroup.id);

    const cookie = await cookieFor(fixture.manager, app);
    const quizResponse = await request(app.getHttpServer())
      .get(`/api/course/${fixture.visibleCourse.id}/statistics/students-quiz-results`)
      .query({
        page: 1,
        perPage: 20,
        quizId: quizLesson.id,
        search: "",
        language: "en",
      })
      .set("Cookie", cookie)
      .expect(200);
    expect(quizResponse.body.data).toEqual([
      expect.objectContaining({
        studentEmail: fixture.assignedLearner.email,
        attempts: 1,
        quizScore: 85,
      }),
    ]);
    expect(quizResponse.body.pagination.totalItems).toBe(1);

    const lessonResponse = await request(app.getHttpServer())
      .get(`/api/lesson/${quizLesson.id}`)
      .query({ language: "en", studentId: fixture.assignedLearner.id })
      .set("Cookie", cookie)
      .expect(200);
    expect(lessonResponse.body.data.quizDetails.questions[0].options[0].id).toBe(
      unansweredQuestion.id,
    );

    const aiResponse = await request(app.getHttpServer())
      .get(`/api/course/${fixture.visibleCourse.id}/statistics/students-ai-mentor-results`)
      .query({ page: 1, perPage: 20, lessonId: aiLesson.id, search: "", language: "en" })
      .set("Cookie", cookie)
      .expect(200);
    expect(aiResponse.body.data).toEqual([
      expect.objectContaining({ studentEmail: fixture.assignedLearner.email, score: 90 }),
    ]);
    expect(aiResponse.body.pagination.totalItems).toBe(1);
  });

  it("deduplicates a learner and shows all of their groups", async () => {
    const overlappingGroup = await groupFactory.withMembers([fixture.assignedLearner.id]).create({
      name: "Second managed team",
      tenantId: defaultTenantId,
    });
    await assignManagedGroup(fixture.manager.id, overlappingGroup.id);
    await groupFactory.withMembers([fixture.assignedLearner.id]).create({
      name: "Unmanaged learner group",
      tenantId: defaultTenantId,
    });
    const cookie = await cookieFor(fixture.manager, app);

    const statsResponse = await request(app.getHttpServer())
      .get(`/api/course/${fixture.visibleCourse.id}/statistics`)
      .set("Cookie", cookie)
      .expect(200);
    expect(statsResponse.body.data.enrolledCount).toBe(1);

    const certificatesResponse = await request(app.getHttpServer())
      .get(`/api/certificates/course/${fixture.visibleCourse.id}?language=en`)
      .set("Cookie", cookie)
      .expect(200);
    expect(certificatesResponse.body.data.data).toHaveLength(1);
    expect(certificatesResponse.body.data.data[0].groups).toEqual(
      expect.arrayContaining(["Managed team", "Second managed team", "Unmanaged learner group"]),
    );

    const groupSearchResponse = await request(app.getHttpServer())
      .get(`/api/certificates/course/${fixture.visibleCourse.id}`)
      .query({ language: "en", search: "second managed" })
      .set("Cookie", cookie)
      .expect(200);
    expect(groupSearchResponse.body.data.data).toHaveLength(1);

    const emailSearchResponse = await request(app.getHttpServer())
      .get(`/api/certificates/course/${fixture.visibleCourse.id}`)
      .query({ language: "en", search: fixture.assignedLearner.email })
      .set("Cookie", cookie)
      .expect(200);
    expect(emailSearchResponse.body.data.data).toHaveLength(1);

    const emptySearchResponse = await request(app.getHttpServer())
      .get(`/api/certificates/course/${fixture.visibleCourse.id}`)
      .query({ language: "en", search: "missing learner" })
      .set("Cookie", cookie)
      .expect(200);
    expect(emptySearchResponse.body.data.data).toEqual([]);
  });

  it("returns 404 for out-of-scope objects and filter IDs", async () => {
    const cookie = await cookieFor(fixture.manager, app);

    await request(app.getHttpServer())
      .get(`/api/course/${fixture.hiddenCourse.id}/statistics`)
      .set("Cookie", cookie)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/certificates/course/${fixture.hiddenCourse.id}`)
      .query({ language: "en" })
      .set("Cookie", cookie)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/course/${fixture.visibleCourse.id}/statistics`)
      .query({ groupId: fixture.outsideGroupId })
      .set("Cookie", cookie)
      .expect(404);
  });

  it("revokes current learner access immediately after membership removal", async () => {
    const cookie = await cookieFor(fixture.manager, app);
    await db
      .delete(groupUsers)
      .where(
        and(
          eq(groupUsers.groupId, fixture.assignedGroupId),
          eq(groupUsers.userId, fixture.assignedLearner.id),
        ),
      );

    const coursesResponse = await request(app.getHttpServer())
      .get("/api/course/all?language=en&page=1&perPage=20")
      .set("Cookie", cookie)
      .expect(200);
    expect(coursesResponse.body.data).toEqual([]);

    await request(app.getHttpServer())
      .get(`/api/course/${fixture.visibleCourse.id}/statistics`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("allows manager curriculum preview without creating progress", async () => {
    const cookie = await cookieFor(fixture.manager, app);

    const courseResponse = await request(app.getHttpServer())
      .get(`/api/course?id=${fixture.visibleCourse.id}&language=en`)
      .set("Cookie", cookie)
      .expect(200);
    expect(courseResponse.body.data.isManagerPreview).toBe(true);

    await request(app.getHttpServer())
      .get(`/api/lesson/${fixture.visibleLessonId}?language=en`)
      .set("Cookie", cookie)
      .expect(200);

    const managerProgress = await db
      .select({ id: studentLessonProgress.id })
      .from(studentLessonProgress)
      .where(eq(studentLessonProgress.studentId, fixture.manager.id));
    expect(managerProgress).toEqual([]);
  });

  it("preserves learner progress behavior for a Student plus Group Manager role combination", async () => {
    await addSystemRoleToUserInTests(
      db,
      fixture.manager.id,
      defaultTenantId,
      SYSTEM_ROLE_SLUGS.STUDENT,
    );
    await enroll(fixture.manager.id, fixture.visibleCourse.id);
    const cookie = await cookieFor(fixture.manager, app);

    const courseResponse = await request(app.getHttpServer())
      .get(`/api/course?id=${fixture.visibleCourse.id}&language=en`)
      .set("Cookie", cookie)
      .expect(200);
    expect(courseResponse.body.data.isManagerPreview).toBe(false);

    await request(app.getHttpServer())
      .get(`/api/lesson/${fixture.visibleLessonId}?language=en`)
      .set("Cookie", cookie)
      .expect(200);

    const managerProgress = await db
      .select({ id: studentLessonProgress.id })
      .from(studentLessonProgress)
      .where(eq(studentLessonProgress.studentId, fixture.manager.id));
    expect(managerProgress).toHaveLength(1);
  });

  it("preserves unrestricted access granted by an Admin plus Group Manager combination", async () => {
    await addSystemRoleToUserInTests(
      db,
      fixture.manager.id,
      defaultTenantId,
      SYSTEM_ROLE_SLUGS.ADMIN,
    );
    const cookie = await cookieFor(fixture.manager, app);

    const response = await request(app.getHttpServer())
      .get(`/api/course/${fixture.hiddenCourse.id}/statistics`)
      .set("Cookie", cookie)
      .expect(200);
    expect(response.body.data.enrolledCount).toBe(1);
  });

  it("allows every system role to coexist and applies their union of permissions", async () => {
    for (const roleSlug of [
      SYSTEM_ROLE_SLUGS.STUDENT,
      SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
      SYSTEM_ROLE_SLUGS.TRAINER,
      SYSTEM_ROLE_SLUGS.ADMIN,
    ]) {
      await addSystemRoleToUserInTests(db, fixture.manager.id, defaultTenantId, roleSlug);
    }
    const cookie = await cookieFor(fixture.manager, app);

    const roles = await db
      .select({ roleId: permissionUserRoles.roleId })
      .from(permissionUserRoles)
      .where(eq(permissionUserRoles.userId, fixture.manager.id));
    expect(roles).toHaveLength(5);

    await request(app.getHttpServer())
      .get(`/api/course/${fixture.hiddenCourse.id}/statistics`)
      .set("Cookie", cookie)
      .expect(200);
  });

  it("lists every certificate outcome without identifiers or download permission", async () => {
    const activeLearner = await createUser("active-certificate");
    const expiredLearner = await createUser("expired-certificate");
    const revokedLearner = await createUser("revoked-certificate");
    await db.insert(groupUsers).values(
      [activeLearner, expiredLearner, revokedLearner].map((learner) => ({
        groupId: fixture.assignedGroupId,
        userId: learner.id,
      })),
    );
    await Promise.all(
      [activeLearner, expiredLearner, revokedLearner].map((learner) =>
        enroll(learner.id, fixture.visibleCourse.id),
      ),
    );

    const [activeCertificate] = await db
      .insert(certificates)
      .values({
        userId: activeLearner.id,
        courseId: fixture.visibleCourse.id,
        expiresAt: new Date("2099-01-01T00:00:00.000Z").toISOString(),
      })
      .returning();
    await db.insert(certificates).values([
      {
        userId: expiredLearner.id,
        courseId: fixture.visibleCourse.id,
        expiresAt: new Date("2020-01-01T00:00:00.000Z").toISOString(),
      },
      {
        userId: revokedLearner.id,
        courseId: fixture.visibleCourse.id,
        status: CERTIFICATE_STATUSES.ARCHIVED,
        archiveReason: CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
        archivedAt: new Date().toISOString(),
      },
    ]);
    await db
      .update(courses)
      .set({
        settings: {
          ...fixture.visibleCourse.settings,
          certificateSignature: "certificate-signature.png",
        },
      })
      .where(eq(courses.id, fixture.visibleCourse.id));
    const cookie = await cookieFor(fixture.manager, app);

    const response = await request(app.getHttpServer())
      .get(`/api/certificates/course/${fixture.visibleCourse.id}?language=en`)
      .set("Cookie", cookie)
      .expect(200);

    const statusByEmail = Object.fromEntries(
      response.body.data.data.map((row: { learnerEmail: string; status: string }) => [
        row.learnerEmail,
        row.status,
      ]),
    );
    expect(statusByEmail).toMatchObject({
      [fixture.assignedLearner.email]: COURSE_CERTIFICATE_STATUSES.NOT_EARNED,
      [activeLearner.email]: COURSE_CERTIFICATE_STATUSES.ACTIVE,
      [expiredLearner.email]: COURSE_CERTIFICATE_STATUSES.EXPIRED,
      [revokedLearner.email]: COURSE_CERTIFICATE_STATUSES.REVOKED,
    });
    expect(response.body.data.data.every((row: object) => !("certificateId" in row))).toBe(true);
    expect(fileServiceMock.getFileUrl).toHaveBeenCalledTimes(1);
    expect(fileServiceMock.getFileUrl).toHaveBeenCalledWith("certificate-signature.png");
    expect(
      response.body.data.data.find(
        (row: { learnerEmail: string }) => row.learnerEmail === revokedLearner.email,
      ).previewAllowed,
    ).toBe(false);

    await request(app.getHttpServer())
      .post("/api/certificates/download")
      .set("Cookie", cookie)
      .send({ certificateId: activeCertificate.id, language: "en" })
      .expect(403);
  });

  it("exports only authorized learner rows and only shared managed-group names", async () => {
    const cookie = await cookieFor(fixture.manager, app);
    const response = await request(app.getHttpServer())
      .get("/api/report/summary?language=en")
      .buffer(true)
      .parse((responseStream, callback) => {
        const chunks: Buffer[] = [];
        responseStream.on("data", (chunk: Buffer) => chunks.push(chunk));
        responseStream.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .set("Cookie", cookie)
      .expect(200);

    const rows = await readXlsxFile(response.body as Buffer);
    const serializedRows = JSON.stringify(rows);
    expect(serializedRows).toContain(
      `${fixture.assignedLearner.firstName} ${fixture.assignedLearner.lastName}`,
    );
    expect(serializedRows).toContain("Managed team");
    expect(serializedRows).not.toContain(
      `${fixture.outsideLearner.firstName} ${fixture.outsideLearner.lastName}`,
    );
    expect(serializedRows).not.toContain("Outside team");
  });

  it("scopes learning-path catalog, detail, and roster outcomes", async () => {
    const visiblePath = await learningPathFactory.create({
      authorId: fixture.admin.id,
      title: { en: "Visible path" },
      description: { en: "Visible path description" },
      baseLanguage: "en",
      availableLocales: ["en"],
    });
    const hiddenPath = await learningPathFactory.create({
      authorId: fixture.admin.id,
      title: { en: "Hidden path" },
      description: { en: "Hidden path description" },
      baseLanguage: "en",
      availableLocales: ["en"],
    });
    await db.insert(studentLearningPaths).values([
      { studentId: fixture.assignedLearner.id, learningPathId: visiblePath.id },
      { studentId: fixture.outsideLearner.id, learningPathId: visiblePath.id },
      { studentId: fixture.outsideLearner.id, learningPathId: hiddenPath.id },
    ]);
    const cookie = await cookieFor(fixture.manager, app);

    const listResponse = await request(app.getHttpServer())
      .get("/api/learning-path?page=1&perPage=20&language=en")
      .set("Cookie", cookie)
      .expect(200);
    expect(listResponse.body.data.map(({ id }: { id: string }) => id)).toEqual([visiblePath.id]);

    await request(app.getHttpServer())
      .get(`/api/learning-path/${hiddenPath.id}?language=en`)
      .set("Cookie", cookie)
      .expect(404);

    const rosterResponse = await request(app.getHttpServer())
      .get(`/api/learning-path/${visiblePath.id}/enroll-users`)
      .query({ page: 1, perPage: 20 })
      .set("Cookie", cookie)
      .expect(200);
    expect(rosterResponse.body.data).toHaveLength(1);
    expect(rosterResponse.body.data[0].email).toBe(fixture.assignedLearner.email);
  });

  it("scopes live-training catalog and dashboard calendar events", async () => {
    await db
      .update(settings)
      .set({
        settings: settingsToJSONBuildObject({
          ...DEFAULT_E2E_GLOBAL_SETTINGS,
          calendarEnabled: true,
          liveTrainingEnabled: true,
        }),
      })
      .where(isNull(settings.userId));

    const adminCookie = await cookieFor(fixture.admin, app);
    const startsAt = new Date(Date.now() + 3_600_000);
    startsAt.setMinutes(Math.ceil(startsAt.getMinutes() / 5) * 5, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 3_600_000);
    const createTraining = (title: string, linkedCourseId: UUIDType) =>
      request(app.getHttpServer())
        .post("/api/live-training")
        .set("Cookie", adminCookie)
        .send({
          language: "en",
          title,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          timezone: "Europe/Warsaw",
          location: "Room 12",
          deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
          linkedCourseIds: [linkedCourseId],
        })
        .expect(201);

    await createTraining("Visible manager training", fixture.visibleCourse.id);
    await createTraining("Hidden manager training", fixture.hiddenCourse.id);

    const managerCookie = await cookieFor(fixture.manager, app);
    const listResponse = await request(app.getHttpServer())
      .get("/api/live-training?page=1&perPage=20&language=en")
      .set("Cookie", managerCookie)
      .expect(200);
    expect(JSON.stringify(listResponse.body.data)).toContain("Visible manager training");
    expect(JSON.stringify(listResponse.body.data)).not.toContain("Hidden manager training");

    const visibleTraining = listResponse.body.data.find(
      ({ title }: { title: string }) => title === "Visible manager training",
    );
    const startResponse = await request(app.getHttpServer())
      .post(`/api/live-training/${visibleTraining.id}/sessions/start`)
      .query({ language: "en" })
      .set("Cookie", adminCookie)
      .expect(201);
    const sessionId = startResponse.body.data.id as UUIDType;
    const joinedAt = new Date().toISOString();
    const participantRows = await db
      .insert(liveTrainingSessionParticipants)
      .values([
        {
          liveTrainingId: visibleTraining.id,
          liveTrainingSessionId: sessionId,
          userId: fixture.assignedLearner.id,
          role: LIVE_TRAINING_PARTICIPANT_ROLES.OBSERVER,
          firstJoinedAt: joinedAt,
          joinCount: 1,
          tenantId: defaultTenantId,
        },
        {
          liveTrainingId: visibleTraining.id,
          liveTrainingSessionId: sessionId,
          userId: fixture.outsideLearner.id,
          role: LIVE_TRAINING_PARTICIPANT_ROLES.OBSERVER,
          firstJoinedAt: joinedAt,
          joinCount: 1,
          tenantId: defaultTenantId,
        },
      ])
      .returning({
        id: liveTrainingSessionParticipants.id,
        userId: liveTrainingSessionParticipants.userId,
      });
    await db.insert(liveTrainingAttendance).values(
      participantRows.map((participant) => ({
        liveTrainingId: visibleTraining.id,
        liveTrainingSessionId: sessionId,
        liveTrainingSessionParticipantId: participant.id,
        userId: participant.userId,
        joinedAt,
        tenantId: defaultTenantId,
      })),
    );
    await db
      .update(liveTrainingSessions)
      .set({ peakParticipantCount: 2, uniqueParticipantCount: 2 })
      .where(eq(liveTrainingSessions.id, sessionId));

    const sessionsResponse = await request(app.getHttpServer())
      .get(`/api/live-training/${visibleTraining.id}/sessions`)
      .query({ language: "en" })
      .set("Cookie", managerCookie)
      .expect(200);
    expect(sessionsResponse.body.data).toEqual([
      expect.objectContaining({
        id: sessionId,
        activeParticipantCount: 1,
        uniqueParticipantCount: 1,
        peakParticipantCount: 1,
      }),
    ]);

    const sessionResponse = await request(app.getHttpServer())
      .get(`/api/live-training/${visibleTraining.id}/sessions/${sessionId}`)
      .query({ language: "en" })
      .set("Cookie", managerCookie)
      .expect(200);
    expect(sessionResponse.body.data.participants).toHaveLength(1);
    expect(sessionResponse.body.data.participants[0].user.id).toBe(fixture.assignedLearner.id);
    expect(JSON.stringify(sessionResponse.body.data)).not.toContain(fixture.outsideLearner.id);

    const calendarResponse = await request(app.getHttpServer())
      .get("/api/calendar/dashboard/events")
      .query({
        start: new Date(startsAt.getTime() - 86_400_000).toISOString(),
        end: new Date(endsAt.getTime() + 86_400_000).toISOString(),
        language: "en",
        timezone: "Europe/Warsaw",
      })
      .set("Cookie", managerCookie)
      .expect(200);
    expect(JSON.stringify(calendarResponse.body.data)).toContain("Visible manager training");
    expect(JSON.stringify(calendarResponse.body.data)).not.toContain("Hidden manager training");
  });

  it("allows admin assignment, cleans assignments on role removal, and blocks manager mutations", async () => {
    const unassignedManager = await createUser(
      "assignment-manager",
      SYSTEM_ROLE_SLUGS.GROUP_MANAGER,
    );
    const adminCookie = await cookieFor(fixture.admin, app);

    const assignmentResponse = await request(app.getHttpServer())
      .patch(`/api/user/admin?id=${unassignedManager.id}`)
      .set("Cookie", adminCookie)
      .send({ managedGroupIds: [fixture.assignedGroupId] })
      .expect(200);
    expect(assignmentResponse.body.data.managedGroups).toEqual([
      expect.objectContaining({ id: fixture.assignedGroupId, name: "Managed team" }),
    ]);
    const preRemovalCookie = await cookieFor(unassignedManager, app);

    await request(app.getHttpServer())
      .patch(`/api/user/admin?id=${unassignedManager.id}`)
      .set("Cookie", adminCookie)
      .send({ roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT] })
      .expect(200);
    const assignments = await db
      .select({ id: groupManagerGroups.id })
      .from(groupManagerGroups)
      .where(eq(groupManagerGroups.managerUserId, unassignedManager.id));
    expect(assignments).toEqual([]);

    await request(app.getHttpServer())
      .get("/api/course/all?language=en&page=1&perPage=20")
      .set("Cookie", preRemovalCookie)
      .expect(401);

    const managerCookie = await cookieFor(fixture.manager, app);
    await request(app.getHttpServer())
      .patch(`/api/user/admin?id=${fixture.assignedLearner.id}`)
      .set("Cookie", managerCookie)
      .send({ firstName: "Forbidden" })
      .expect(403);
  });

  it("rejects nonexistent managed-group assignments without changing the current scope", async () => {
    const adminCookie = await cookieFor(fixture.admin, app);

    await request(app.getHttpServer())
      .patch(`/api/user/admin?id=${fixture.manager.id}`)
      .set("Cookie", adminCookie)
      .send({ managedGroupIds: [crypto.randomUUID()] })
      .expect(404);

    const assignments = await db
      .select({ groupId: groupManagerGroups.groupId })
      .from(groupManagerGroups)
      .where(eq(groupManagerGroups.managerUserId, fixture.manager.id));
    expect(assignments).toEqual([{ groupId: fixture.assignedGroupId }]);
  });

  it("keeps Group Manager assignments separate from learner membership", async () => {
    const managerMemberships = await db
      .select({ groupId: groupUsers.groupId })
      .from(groupUsers)
      .where(eq(groupUsers.userId, fixture.manager.id));
    expect(managerMemberships).toEqual([]);

    const managerEnrollments = await db
      .select({ id: studentCourses.id })
      .from(studentCourses)
      .where(eq(studentCourses.studentId, fixture.manager.id));
    expect(managerEnrollments).toEqual([]);

    const managerRoles = await db
      .select({ roleId: permissionUserRoles.roleId })
      .from(permissionUserRoles)
      .where(eq(permissionUserRoles.userId, fixture.manager.id));
    expect(managerRoles).toHaveLength(1);
  });
});
