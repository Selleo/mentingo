import {
  CERTIFICATE_ARCHIVE_REASONS,
  CERTIFICATE_RESET_SCOPES,
  CERTIFICATE_STATUSES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { and, eq } from "drizzle-orm";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";
import { ACTIVITY_LOG_ACTION_TYPES } from "../../activity-logs/types";
import { DEFAULT_PAGE_SIZE } from "../../common/pagination";
import { DEFAULT_GLOBAL_SETTINGS } from "../../settings/constants/settings.constants";
import { SettingsService } from "../../settings/settings.service";
import {
  activityLogs,
  certificates,
  chapters,
  lessons,
  questions,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
  studentQuestionAnswers,
} from "../../storage/schema";
import {
  CERTIFICATE_ACTIVITY_TRIGGERS,
  SYSTEM_ACTOR_ROLE,
} from "../certificates.activity.constants";
import { CertificatesService } from "../certificates.service";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("CertificatesController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;
  let certificatesService: CertificatesService;
  let settingsService: SettingsService;
  const password = "password123";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest({ enableActivityLogs: true });
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
    groupFactory = createGroupFactory(db);
    certificatesService = app.get(CertificatesService);
    settingsService = app.get(SettingsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
  });

  afterEach(async () => {
    await truncateAllTables(baseDb, db);
  });

  describe("GET /api/certificates/all", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        await request(app.getHttpServer()).get("/api/certificates/all").expect(401);
      });
    });

    describe("when user is logged in", () => {
      it("returns certificates of specific user", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .withAdminRole()
          .create();

        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create();

        const cookies = await cookieFor(student, app);

        const category = await categoryFactory.create();

        const course = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });

        await db.insert(certificates).values({
          userId: student.id,
          courseId: course.id,
        });

        const response = await request(app.getHttpServer())
          .get("/api/certificates/all")
          .set("Cookie", cookies)
          .query({ userId: student.id, language: "en" })
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBeDefined();
        expect(response.body.data[0].courseId).toBe(course.id);
        expect(response.body.data[0].courseTitle).toBe(course.title);
        expect(response.body.data[0].completionDate).toEqual(expect.any(String));
        expect(response.body.data[0].issuedAt).toEqual(expect.any(String));
        expect(response.body.data[0].fullName).toBe(`${student.firstName} ${student.lastName}`);
        expect(response.body.data[0].userId).toBe(student.id);
        expect(response.body.pagination.totalItems).toBe(1);
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.perPage).toBe(DEFAULT_PAGE_SIZE);
      });

      it("does not return archived certificates", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .withAdminRole()
          .create();

        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create();

        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const course = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });

        await db.insert(certificates).values([
          {
            userId: student.id,
            courseId: course.id,
            status: CERTIFICATE_STATUSES.ARCHIVED,
            archivedAt: new Date().toISOString(),
            archiveReason: CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
          },
          {
            userId: student.id,
            courseId: course.id,
            status: CERTIFICATE_STATUSES.ACTIVE,
          },
        ]);

        const response = await request(app.getHttpServer())
          .get("/api/certificates/all")
          .set("Cookie", cookies)
          .query({ userId: student.id, language: "en" })
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].courseId).toBe(course.id);
        expect(response.body.pagination.totalItems).toBe(1);
      });

      it("returns certificates of specific user with pagination", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const course1 = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });
        const course2 = await courseFactory.create({
          title: "JavaScript Course",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });
        await db.insert(certificates).values({
          userId: student.id,
          courseId: course1.id,
        });
        await db.insert(certificates).values({
          userId: student.id,
          courseId: course2.id,
        });

        const response = await request(app.getHttpServer())
          .get("/api/certificates/all")
          .set("Cookie", cookies)
          .query({ userId: student.id, language: "en", perPage: 1, page: 2 })
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].courseId).toBe(course2.id);
      });

      it("returns certificates of specific user with sorting", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const course1 = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });
        const course2 = await courseFactory.create({
          title: "JavaScript Course",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });
        await db.insert(certificates).values({
          userId: student.id,
          courseId: course2.id,
        });
        await db.insert(certificates).values({
          userId: student.id,
          courseId: course1.id,
        });

        const response = await request(app.getHttpServer())
          .get("/api/certificates/all")
          .set("Cookie", cookies)
          .query({ userId: student.id, language: "en", sort: "createdAt" })
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].courseId).toBe(course2.id);
        expect(response.body.data[1].courseId).toBe(course1.id);
      });
    });
  });

  describe("GET /api/cerfiticates/certificate", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        await request(app.getHttpServer()).get("/api/certificates/certificate").expect(401);
      });
    });

    describe("when user is logged in", () => {
      it("returns specific certificate of specific user", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const course = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });
        await db.insert(certificates).values({
          userId: student.id,
          courseId: course.id,
        });

        const response = await request(app.getHttpServer())
          .get("/api/certificates/certificate")
          .set("Cookie", cookies)
          .query({ userId: student.id, courseId: course.id, language: "en" })
          .expect(200);

        expect(response.body.id).toBeDefined();
        expect(response.body.courseId).toBe(course.id);
        expect(response.body.courseTitle).toBe(course.title);
        expect(response.body.completionDate).toEqual(expect.any(String));
        expect(response.body.issuedAt).toEqual(expect.any(String));
        expect(response.body.fullName).toBe(`${student.firstName} ${student.lastName}`);
        expect(response.body.userId).toBe(student.id);
      });

      it("returns an empty array if certificate does not exist", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const course = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });

        const response = await request(app.getHttpServer())
          .get("/api/certificates/certificate")
          .set("Cookie", cookies)
          .query({ userId: student.id, courseId: course.id, language: "en" })
          .expect(200);

        expect(response.body).toEqual({});
      });

      it("returns an empty object for archived certificates", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const course = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });

        await db.insert(certificates).values({
          userId: student.id,
          courseId: course.id,
          status: CERTIFICATE_STATUSES.ARCHIVED,
          archivedAt: new Date().toISOString(),
          archiveReason: CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
        });

        const response = await request(app.getHttpServer())
          .get("/api/certificates/certificate")
          .set("Cookie", cookies)
          .query({ userId: student.id, courseId: course.id, language: "en" })
          .expect(200);

        expect(response.body).toEqual({});
      });
    });
  });

  describe("POST /api/certificates/course/:courseId/reset", () => {
    it("archives active certificates, resets progress, and records activity", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const cookies = await cookieFor(admin, app);
      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        title: "Python Basics",
        authorId: admin.id,
        categoryId: category.id,
        thumbnailS3Key: null,
        hasCertificate: true,
      });
      const now = new Date().toISOString();
      const [chapter] = await db
        .insert(chapters)
        .values({
          title: { en: "Chapter 1" },
          courseId: course.id,
          authorId: admin.id,
          displayOrder: 1,
          lessonCount: 1,
        })
        .returning();
      const [lesson] = await db
        .insert(lessons)
        .values({
          title: { en: "Quiz 1" },
          chapterId: chapter.id,
          type: "quiz",
          thresholdScore: 0,
          displayOrder: 1,
        })
        .returning();
      const [question] = await db
        .insert(questions)
        .values({
          title: { en: "Question 1" },
          lessonId: lesson.id,
          authorId: admin.id,
          type: "single_choice",
          displayOrder: 1,
        })
        .returning();

      await db.insert(studentCourses).values({
        studentId: student.id,
        courseId: course.id,
        progress: "completed",
        finishedChapterCount: 2,
        completedAt: now,
        courseCompletionMetadata: { source: "test" },
      });
      await db.insert(studentChapterProgress).values({
        studentId: student.id,
        courseId: course.id,
        chapterId: chapter.id,
        completedLessonCount: 1,
        completedAt: now,
        completedAsFreemium: true,
      });
      await db.insert(studentLessonProgress).values({
        studentId: student.id,
        chapterId: chapter.id,
        lessonId: lesson.id,
        completedQuestionCount: 1,
        quizScore: 100,
        attempts: 1,
        isQuizPassed: true,
        isStarted: true,
        completedAt: now,
        languageAnswered: "en",
      });
      await db.insert(studentQuestionAnswers).values({
        studentId: student.id,
        questionId: question.id,
        answer: { selected: "answer-a" },
        isCorrect: true,
      });

      const [createdCertificate] = await db
        .insert(certificates)
        .values({
          userId: student.id,
          courseId: course.id,
          status: CERTIFICATE_STATUSES.ACTIVE,
        })
        .returning();

      const response = await request(app.getHttpServer())
        .post(`/api/certificates/course/${course.id}/reset`)
        .set("Cookie", cookies)
        .send({ scope: CERTIFICATE_RESET_SCOPES.ALL, sendEmail: false })
        .expect(201);

      expect(response.body).toEqual({
        affectedCertificateCount: 1,
        affectedUserCount: 1,
      });

      const [certificate] = await db
        .select()
        .from(certificates)
        .where(eq(certificates.id, createdCertificate.id));
      expect(certificate.status).toBe(CERTIFICATE_STATUSES.ARCHIVED);
      expect(certificate.archiveReason).toBe(CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET);
      expect(certificate.archivedAt).not.toBeNull();

      const [studentCourse] = await db
        .select()
        .from(studentCourses)
        .where(
          and(eq(studentCourses.studentId, student.id), eq(studentCourses.courseId, course.id)),
        );
      expect(studentCourse.progress).toBe("not_started");
      expect(studentCourse.finishedChapterCount).toBe(0);
      expect(studentCourse.completedAt).toBeNull();
      expect(studentCourse.courseCompletionMetadata).toBeNull();

      const [lessonProgress] = await db
        .select()
        .from(studentLessonProgress)
        .where(
          and(
            eq(studentLessonProgress.studentId, student.id),
            eq(studentLessonProgress.lessonId, lesson.id),
          ),
        );
      expect(lessonProgress).toBeDefined();
      expect(lessonProgress.completedQuestionCount).toBe(0);
      expect(lessonProgress.quizScore).toBe(0);
      expect(lessonProgress.attempts).toBeNull();
      expect(lessonProgress.isQuizPassed).toBeNull();
      expect(lessonProgress.isStarted).toBe(false);
      expect(lessonProgress.completedAt).toBeNull();
      expect(lessonProgress.languageAnswered).toBe("en");

      const [chapterProgress] = await db
        .select()
        .from(studentChapterProgress)
        .where(
          and(
            eq(studentChapterProgress.studentId, student.id),
            eq(studentChapterProgress.chapterId, chapter.id),
          ),
        );
      expect(chapterProgress).toBeDefined();
      expect(chapterProgress.completedLessonCount).toBe(0);
      expect(chapterProgress.completedAt).toBeNull();
      expect(chapterProgress.completedAsFreemium).toBe(false);

      const quizAnswers = await db
        .select()
        .from(studentQuestionAnswers)
        .where(eq(studentQuestionAnswers.studentId, student.id));
      expect(quizAnswers).toHaveLength(0);

      const [activityLog] = await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.actionType, ACTIVITY_LOG_ACTION_TYPES.RESET_CERTIFICATE));
      expect(activityLog.actorId).toBe(admin.id);
      expect(activityLog.resourceId).toBe(course.id);
      expect(activityLog.metadata.context).toMatchObject({
        certificateId: createdCertificate.id,
        userId: student.id,
        reason: CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
        trigger: CERTIFICATE_ACTIVITY_TRIGGERS.MANUAL,
      });
    });

    it("resets only selected users with active certificates", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const selectedStudent = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const untouchedStudent = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const selectedStudentWithoutCertificate = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const cookies = await cookieFor(admin, app);
      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        title: "User Reset",
        authorId: admin.id,
        categoryId: category.id,
        thumbnailS3Key: null,
        hasCertificate: true,
      });

      await db.insert(studentCourses).values([
        {
          studentId: selectedStudent.id,
          courseId: course.id,
          progress: "completed",
          finishedChapterCount: 1,
          completedAt: new Date().toISOString(),
        },
        {
          studentId: untouchedStudent.id,
          courseId: course.id,
          progress: "completed",
          finishedChapterCount: 1,
          completedAt: new Date().toISOString(),
        },
      ]);
      const [selectedCertificate, untouchedCertificate] = await db
        .insert(certificates)
        .values([
          {
            userId: selectedStudent.id,
            courseId: course.id,
            status: CERTIFICATE_STATUSES.ACTIVE,
          },
          {
            userId: untouchedStudent.id,
            courseId: course.id,
            status: CERTIFICATE_STATUSES.ACTIVE,
          },
        ])
        .returning();

      const response = await request(app.getHttpServer())
        .post(`/api/certificates/course/${course.id}/reset`)
        .set("Cookie", cookies)
        .send({
          scope: CERTIFICATE_RESET_SCOPES.USERS,
          userIds: [selectedStudent.id, selectedStudentWithoutCertificate.id],
          sendEmail: false,
        })
        .expect(201);

      expect(response.body).toEqual({
        affectedCertificateCount: 1,
        affectedUserCount: 1,
      });

      const updatedCertificates = await db.select().from(certificates);
      expect(
        updatedCertificates.find((certificate) => certificate.id === selectedCertificate.id),
      ).toMatchObject({
        status: CERTIFICATE_STATUSES.ARCHIVED,
        archiveReason: CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
      });
      expect(
        updatedCertificates.find((certificate) => certificate.id === untouchedCertificate.id),
      ).toMatchObject({
        status: CERTIFICATE_STATUSES.ACTIVE,
        archiveReason: null,
      });

      const studentCourseRows = await db.select().from(studentCourses);
      expect(
        studentCourseRows.find((studentCourse) => studentCourse.studentId === selectedStudent.id),
      ).toMatchObject({
        progress: "not_started",
        finishedChapterCount: 0,
        completedAt: null,
      });
      expect(
        studentCourseRows.find((studentCourse) => studentCourse.studentId === untouchedStudent.id),
      ).toMatchObject({
        progress: "completed",
        finishedChapterCount: 1,
      });
    });

    it("resets selected groups without duplicating users who belong to multiple groups", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const sharedGroupStudent = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const firstGroupStudent = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const otherGroupStudent = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const cookies = await cookieFor(admin, app);
      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        title: "Group Reset",
        authorId: admin.id,
        categoryId: category.id,
        thumbnailS3Key: null,
        hasCertificate: true,
      });
      const firstGroup = await groupFactory
        .withMembers([sharedGroupStudent.id, firstGroupStudent.id])
        .create();
      const secondGroup = await groupFactory.withMembers([sharedGroupStudent.id]).create();
      const otherGroup = await groupFactory.withMembers([otherGroupStudent.id]).create();

      await db.insert(studentCourses).values([
        {
          studentId: sharedGroupStudent.id,
          courseId: course.id,
          progress: "completed",
          finishedChapterCount: 1,
          completedAt: new Date().toISOString(),
        },
        {
          studentId: firstGroupStudent.id,
          courseId: course.id,
          progress: "completed",
          finishedChapterCount: 1,
          completedAt: new Date().toISOString(),
        },
        {
          studentId: otherGroupStudent.id,
          courseId: course.id,
          progress: "completed",
          finishedChapterCount: 1,
          completedAt: new Date().toISOString(),
        },
      ]);
      const createdCertificates = await db
        .insert(certificates)
        .values([
          {
            userId: sharedGroupStudent.id,
            courseId: course.id,
            status: CERTIFICATE_STATUSES.ACTIVE,
          },
          {
            userId: firstGroupStudent.id,
            courseId: course.id,
            status: CERTIFICATE_STATUSES.ACTIVE,
          },
          {
            userId: otherGroupStudent.id,
            courseId: course.id,
            status: CERTIFICATE_STATUSES.ACTIVE,
          },
        ])
        .returning();

      const response = await request(app.getHttpServer())
        .post(`/api/certificates/course/${course.id}/reset`)
        .set("Cookie", cookies)
        .send({
          scope: CERTIFICATE_RESET_SCOPES.GROUPS,
          groupIds: [firstGroup.id, secondGroup.id],
          sendEmail: false,
        })
        .expect(201);

      expect(response.body).toEqual({
        affectedCertificateCount: 2,
        affectedUserCount: 2,
      });

      const updatedCertificates = await db.select().from(certificates);
      const archivedCertificateUserIds = updatedCertificates
        .filter((certificate) => certificate.status === CERTIFICATE_STATUSES.ARCHIVED)
        .map((certificate) => certificate.userId);
      expect(archivedCertificateUserIds).toEqual(
        expect.arrayContaining([sharedGroupStudent.id, firstGroupStudent.id]),
      );
      expect(archivedCertificateUserIds).not.toContain(otherGroupStudent.id);
      expect(
        updatedCertificates.find(
          (certificate) =>
            certificate.id ===
            createdCertificates.find(({ userId }) => userId === otherGroupStudent.id)?.id,
        ),
      ).toMatchObject({
        status: CERTIFICATE_STATUSES.ACTIVE,
      });

      const studentCourseRows = await db.select().from(studentCourses);
      expect(
        studentCourseRows.find(
          (studentCourse) => studentCourse.studentId === sharedGroupStudent.id,
        ),
      ).toMatchObject({
        progress: "not_started",
        finishedChapterCount: 0,
        completedAt: null,
      });
      expect(
        studentCourseRows.find((studentCourse) => studentCourse.studentId === firstGroupStudent.id),
      ).toMatchObject({
        progress: "not_started",
        finishedChapterCount: 0,
        completedAt: null,
      });
      expect(
        studentCourseRows.find((studentCourse) => studentCourse.studentId === otherGroupStudent.id),
      ).toMatchObject({
        progress: "completed",
        finishedChapterCount: 1,
      });

      expect(otherGroup.id).toBeDefined();
    });

    it("returns validation errors for reset scopes without selected ids", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const cookies = await cookieFor(admin, app);
      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        title: "Validation Reset",
        authorId: admin.id,
        categoryId: category.id,
        thumbnailS3Key: null,
        hasCertificate: true,
      });

      await request(app.getHttpServer())
        .post(`/api/certificates/course/${course.id}/reset`)
        .set("Cookie", cookies)
        .send({ scope: CERTIFICATE_RESET_SCOPES.GROUPS, sendEmail: false })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/certificates/course/${course.id}/reset`)
        .set("Cookie", cookies)
        .send({ scope: CERTIFICATE_RESET_SCOPES.USERS, sendEmail: false })
        .expect(400);
    });
  });

  describe("GET /api/certificates/course/:courseId/reset-options", () => {
    it("returns groups and active certificate user count", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const studentWithCertificate = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const studentWithoutCertificate = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const nonEnrolledStudentWithCertificate = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const cookies = await cookieFor(admin, app);
      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        title: "Certificate Options",
        authorId: admin.id,
        categoryId: category.id,
        thumbnailS3Key: null,
        hasCertificate: true,
      });
      const groupWithCertificate = await groupFactory
        .withMembers([studentWithCertificate.id, studentWithoutCertificate.id])
        .create();
      const groupWithoutCertificate = await groupFactory
        .withMembers([studentWithoutCertificate.id])
        .create();

      await db.insert(studentCourses).values([
        {
          studentId: studentWithCertificate.id,
          courseId: course.id,
        },
        {
          studentId: studentWithoutCertificate.id,
          courseId: course.id,
        },
      ]);
      await db.insert(certificates).values([
        {
          userId: studentWithCertificate.id,
          courseId: course.id,
          status: CERTIFICATE_STATUSES.ACTIVE,
        },
        {
          userId: studentWithoutCertificate.id,
          courseId: course.id,
          status: CERTIFICATE_STATUSES.ARCHIVED,
          archivedAt: new Date().toISOString(),
          archiveReason: CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
        },
        {
          userId: nonEnrolledStudentWithCertificate.id,
          courseId: course.id,
          status: CERTIFICATE_STATUSES.ACTIVE,
        },
      ]);

      const response = await request(app.getHttpServer())
        .get(`/api/certificates/course/${course.id}/reset-options`)
        .set("Cookie", cookies)
        .expect(200);

      expect(response.body.groups).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: groupWithCertificate.id,
            activeCertificateCount: 1,
          }),
        ]),
      );
      expect(
        response.body.groups.some(
          (group: { id: string }) => group.id === groupWithoutCertificate.id,
        ),
      ).toBe(false);
      expect(response.body.activeCertificateUserCount).toBe(1);
      expect(response.body.users).toBeUndefined();
    });
  });

  describe("GET /api/certificates/course/:courseId/reset-users", () => {
    it("returns paginated active certificate users with search", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const alphaStudent = await userFactory.withUserSettings(db).create({
        role: SYSTEM_ROLE_SLUGS.STUDENT,
        firstName: "Alpha",
        lastName: "Reset",
        email: "alpha-reset@example.com",
      });
      const betaStudent = await userFactory.withUserSettings(db).create({
        role: SYSTEM_ROLE_SLUGS.STUDENT,
        firstName: "Beta",
        lastName: "Reset",
        email: "beta-reset@example.com",
      });
      const gammaStudent = await userFactory.withUserSettings(db).create({
        role: SYSTEM_ROLE_SLUGS.STUDENT,
        firstName: "Gamma",
        lastName: "Reset",
        email: "gamma-reset@example.com",
      });
      const archivedCertificateStudent = await userFactory.withUserSettings(db).create({
        role: SYSTEM_ROLE_SLUGS.STUDENT,
        firstName: "Archived",
        lastName: "Reset",
        email: "archived-reset@example.com",
      });
      const nonEnrolledStudent = await userFactory.withUserSettings(db).create({
        role: SYSTEM_ROLE_SLUGS.STUDENT,
        firstName: "External",
        lastName: "Reset",
        email: "external-reset@example.com",
      });
      const cookies = await cookieFor(admin, app);
      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        title: "Certificate Reset Users",
        authorId: admin.id,
        categoryId: category.id,
        thumbnailS3Key: null,
        hasCertificate: true,
      });

      await db.insert(studentCourses).values([
        { studentId: alphaStudent.id, courseId: course.id },
        { studentId: betaStudent.id, courseId: course.id },
        { studentId: gammaStudent.id, courseId: course.id },
        { studentId: archivedCertificateStudent.id, courseId: course.id },
      ]);

      await db.insert(certificates).values([
        {
          userId: alphaStudent.id,
          courseId: course.id,
          status: CERTIFICATE_STATUSES.ACTIVE,
        },
        {
          userId: betaStudent.id,
          courseId: course.id,
          status: CERTIFICATE_STATUSES.ACTIVE,
        },
        {
          userId: gammaStudent.id,
          courseId: course.id,
          status: CERTIFICATE_STATUSES.ACTIVE,
        },
        {
          userId: archivedCertificateStudent.id,
          courseId: course.id,
          status: CERTIFICATE_STATUSES.ARCHIVED,
          archivedAt: new Date().toISOString(),
          archiveReason: CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
        },
        {
          userId: nonEnrolledStudent.id,
          courseId: course.id,
          status: CERTIFICATE_STATUSES.ACTIVE,
        },
      ]);

      const firstPageResponse = await request(app.getHttpServer())
        .get(`/api/certificates/course/${course.id}/reset-users`)
        .query({ page: 1, perPage: 2 })
        .set("Cookie", cookies)
        .expect(200);

      expect(firstPageResponse.body.pagination).toMatchObject({
        totalItems: 3,
        page: 1,
        perPage: 2,
      });
      expect(firstPageResponse.body.data).toHaveLength(2);
      expect(firstPageResponse.body.data.map((user: { id: string }) => user.id)).toEqual([
        alphaStudent.id,
        betaStudent.id,
      ]);
      expect(firstPageResponse.body.data).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: archivedCertificateStudent.id }),
          expect.objectContaining({ id: nonEnrolledStudent.id }),
        ]),
      );

      const secondPageResponse = await request(app.getHttpServer())
        .get(`/api/certificates/course/${course.id}/reset-users`)
        .query({ page: 2, perPage: 2 })
        .set("Cookie", cookies)
        .expect(200);

      expect(secondPageResponse.body.pagination).toMatchObject({
        totalItems: 3,
        page: 2,
        perPage: 2,
      });
      expect(secondPageResponse.body.data).toEqual([
        expect.objectContaining({
          id: gammaStudent.id,
          email: "gamma-reset@example.com",
        }),
      ]);

      const searchResponse = await request(app.getHttpServer())
        .get(`/api/certificates/course/${course.id}/reset-users`)
        .query({ search: "gamma-reset" })
        .set("Cookie", cookies)
        .expect(200);

      expect(searchResponse.body.pagination.totalItems).toBe(1);
      expect(searchResponse.body.data).toEqual([
        expect.objectContaining({
          id: gammaStudent.id,
          email: "gamma-reset@example.com",
        }),
      ]);
      expect(searchResponse.body.appliedFilters).toMatchObject({ search: "gamma-reset" });

      const fullNameSearchResponse = await request(app.getHttpServer())
        .get(`/api/certificates/course/${course.id}/reset-users`)
        .query({ search: "Reset Alpha" })
        .set("Cookie", cookies)
        .expect(200);

      expect(fullNameSearchResponse.body.pagination.totalItems).toBe(1);
      expect(fullNameSearchResponse.body.data).toEqual([
        expect.objectContaining({
          id: alphaStudent.id,
          email: "alpha-reset@example.com",
        }),
      ]);

      const emptySearchResponse = await request(app.getHttpServer())
        .get(`/api/certificates/course/${course.id}/reset-users`)
        .query({ search: "missing-user" })
        .set("Cookie", cookies)
        .expect(200);

      expect(emptySearchResponse.body.pagination.totalItems).toBe(0);
      expect(emptySearchResponse.body.data).toEqual([]);
    });

    it("requires a user who can manage course certificates", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const studentCookies = await cookieFor(student, app);
      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        title: "Protected Certificate Reset Users",
        authorId: admin.id,
        categoryId: category.id,
        thumbnailS3Key: null,
        hasCertificate: true,
      });

      await request(app.getHttpServer())
        .get(`/api/certificates/course/${course.id}/reset-users`)
        .expect(401);

      await request(app.getHttpServer())
        .get(`/api/certificates/course/${course.id}/reset-users`)
        .set("Cookie", studentCookies)
        .expect(403);
    });
  });

  describe("Certificate expiration", () => {
    it("should record system expiration activity with company short name-based actor email", async () => {
      await settingsService.updateCompanyInformation({
        ...DEFAULT_GLOBAL_SETTINGS.companyInformation,
        companyName: "Acme Learning",
        companyShortName: "Acme LMS",
      });

      const admin = await userFactory.withAdminSettings(db).withAdminRole().create();
      const student = await userFactory
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        title: "Expiring Certificate Course",
        authorId: admin.id,
        categoryId: category.id,
        thumbnailS3Key: null,
        hasCertificate: true,
      });
      const [createdCertificate] = await db
        .insert(certificates)
        .values({
          userId: student.id,
          courseId: course.id,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        })
        .returning();

      await certificatesService.expireCertificates();

      const [activityLog] = await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.actionType, ACTIVITY_LOG_ACTION_TYPES.EXPIRE_CERTIFICATE));

      expect(activityLog.actorId).toBe(student.id);
      expect(activityLog.actorEmail).toBe("system@acmelms");
      expect(activityLog.actorRole).toBe(SYSTEM_ACTOR_ROLE);
      expect(activityLog.resourceId).toBe(course.id);
      expect(activityLog.metadata.context).toMatchObject({
        certificateId: createdCertificate.id,
        userId: student.id,
        reason: CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
        trigger: CERTIFICATE_ACTIVITY_TRIGGERS.SYSTEM,
      });
    });

    it("should fall back to mentingo in system expiration actor email when company short name is missing", async () => {
      const admin = await userFactory.withAdminSettings(db).withAdminRole().create();
      const student = await userFactory
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        title: "Fallback Expiring Certificate Course",
        authorId: admin.id,
        categoryId: category.id,
        thumbnailS3Key: null,
        hasCertificate: true,
      });

      await db.insert(certificates).values({
        userId: student.id,
        courseId: course.id,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      });

      await certificatesService.expireCertificates();

      const [activityLog] = await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.actionType, ACTIVITY_LOG_ACTION_TYPES.EXPIRE_CERTIFICATE));

      expect(activityLog.actorEmail).toBe("system@mentingo.com");
    });
  });

  describe("POST /api/certificates/download", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        await request(app.getHttpServer()).post("/api/certificates/download").expect(401);
      });
    });

    describe("when user is logged in", () => {
      it("returns pdf file", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const course = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });
        const [createdCertificate] = await db
          .insert(certificates)
          .values({
            userId: student.id,
            courseId: course.id,
          })
          .returning();

        const response = await request(app.getHttpServer())
          .post("/api/certificates/download")
          .set("Cookie", cookies)
          .send({ certificateId: createdCertificate.id, language: "en" })
          .expect(201);

        expect(response.headers["content-type"]).toBe("application/pdf");
        expect(response.headers["content-disposition"]).toContain(
          'attachment; filename="Python Basics.pdf"',
        );
        expect(response.headers["content-disposition"]).toContain(
          "filename*=UTF-8''Python%20Basics.pdf",
        );
        expect(response.body instanceof Buffer).toBe(true);
      });

      it("returns pdf file with custom filename", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const course = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });
        const [createdCertificate] = await db
          .insert(certificates)
          .values({
            userId: student.id,
            courseId: course.id,
          })
          .returning();

        const response = await request(app.getHttpServer())
          .post("/api/certificates/download")
          .set("Cookie", cookies)
          .send({ certificateId: createdCertificate.id, language: "en" })
          .expect(201);

        expect(response.headers["content-type"]).toBe("application/pdf");
        expect(response.headers["content-disposition"]).toBe(
          "attachment; filename=\"Python Basics.pdf\"; filename*=UTF-8''Python%20Basics.pdf",
        );
        expect(response.body instanceof Buffer).toBe(true);
      });

      it("returns 400 when html content is empty", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
        const cookies = await cookieFor(student, app);

        await request(app.getHttpServer())
          .post("/api/certificates/download")
          .set("Cookie", cookies)
          .send({ language: "en" })
          .expect(400);
      });
    });
  });
});
