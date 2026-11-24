import { LESSON_TYPES, SUPPORTED_LANGUAGES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, eq } from "drizzle-orm";

import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import {
  activityLogs,
  assessmentAttempts,
  certificates,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
  tenants,
} from "src/storage/schema";

import { createAssessmentAttemptFactory } from "../factory/assessment-attempt.factory";
import { createCertificateFactory } from "../factory/certificate.factory";
import { createChapterFactory } from "../factory/chapter.factory";
import { createCourseFactory } from "../factory/course.factory";
import { createGroupFactory } from "../factory/group.factory";
import { createLessonFactory } from "../factory/lesson.factory";
import { createStudentChapterProgressFactory } from "../factory/student-chapter-progress.factory";
import { createStudentCourseFactory } from "../factory/student-course.factory";
import { createStudentLessonProgressFactory } from "../factory/student-lesson-progress.factory";
import { createTenantFactory } from "../factory/tenant.factory";
import { createUserFactory } from "../factory/user.factory";

import { COURSE_ENROLLMENT_TABLES, createCourseEnrollmentHelpers } from "./course-enrollment";
import {
  addSystemRoleToUserInTests,
  assignSystemRoleToUserInTests,
} from "./permission-role-helpers";
import { cookieFor } from "./test-helpers";
import { waitForOutbox } from "./wait-for-outbox";

import type { SignedInUser } from "./course-enrollment";
import type { truncateTables } from "./test-helpers";
import type { INestApplication } from "@nestjs/common";
import type { ActivityLogActionType } from "src/activity-logs/types";
import type { DatabasePg, UUIDType } from "src/common";
import type { CertificateTest } from "test/factory/certificate.factory";
import type { CourseTest } from "test/factory/course.factory";
import type { StudentCourseTest } from "test/factory/student-course.factory";
import type { UserWithCredentials } from "test/factory/user.factory";

export const CERTIFICATE_TABLES: Parameters<typeof truncateTables>[1] = [
  "outbox_events",
  "activity_logs",
  "automation_email_deliveries",
  "automation_runs",
  "automation_occurrences",
  "certificates",
  "assessment_attempts",
  "assessments",
  "group_manager_groups",
  ...COURSE_ENROLLMENT_TABLES,
];

const TEST_PASSWORD = "Password123@";

const OTHER_TENANT_HOST = "https://other-certificate-tenant.local";

type RunInTenant = <T>(fn: () => Promise<T>) => Promise<T>;

type CertificateCourseOverrides = Partial<Omit<CourseTest, "authorId">>;

/** Seeds certificates and their courses through the tenant-scoped (RLS) connection. */
export const createCertificateHelpers = ({
  app,
  db,
  runInTenant,
}: {
  app: INestApplication;
  db: DatabasePg;
  runInTenant: RunInTenant;
}) => {
  const enrollmentHelpers = createCourseEnrollmentHelpers({ app, db, runInTenant });

  const arrangeCertificateCourse = (
    authorId: UUIDType,
    overrides: CertificateCourseOverrides = {},
  ) =>
    runInTenant(() =>
      createCourseFactory(db).create({
        authorId,
        hasCertificate: true,
        thumbnailS3Key: null,
        ...overrides,
      }),
    );

  const arrangeCertificate = (certificate: CertificateTest) =>
    runInTenant(() => createCertificateFactory(db).create(certificate));

  const arrangeArchivedCertificate = (
    certificate: CertificateTest,
    archiveReason: NonNullable<CertificateTest["archiveReason"]>,
  ) => runInTenant(() => createCertificateFactory(db).archived(archiveReason).create(certificate));

  const arrangeEnrollment = (
    studentId: UUIDType,
    courseId: UUIDType,
    overrides: Partial<StudentCourseTest> = {},
  ) =>
    runInTenant(() => createStudentCourseFactory(db).create({ studentId, courseId, ...overrides }));

  const arrangeManagedGroup = (managerId: UUIDType, memberIds: UUIDType[]) =>
    runInTenant(() =>
      createGroupFactory(db).withMembers(memberIds).withManagers([managerId]).create(),
    );

  const arrangeLearner = (attributes: Partial<UserWithCredentials> = {}) =>
    runInTenant(() =>
      createUserFactory(db)
        .withCredentials({ password: TEST_PASSWORD })
        .withUserSettings(db)
        .create(attributes),
    );

  const arrangeSignedInLearner = async (
    attributes: Partial<UserWithCredentials> = {},
  ): Promise<SignedInUser> => {
    const learner = await arrangeLearner(attributes);

    return { user: learner, cookies: await cookieFor(learner, app) };
  };

  /** Group managers need user settings to sign in, which the enrollment helper does not seed. */
  const arrangeSignedInGroupManager = async (): Promise<SignedInUser> => {
    const manager = await runInTenant(async () => {
      const user = await createUserFactory(db)
        .withCredentials({ password: TEST_PASSWORD })
        .withUserSettings(db)
        .create();
      await assignSystemRoleToUserInTests(
        db,
        user.id,
        user.tenantId,
        SYSTEM_ROLE_SLUGS.GROUP_MANAGER,
      );

      return user;
    });

    return { user: manager, cookies: await cookieFor(manager, app) };
  };

  const arrangeGroupManagerRole = (userId: UUIDType, tenantId: UUIDType) =>
    runInTenant(() =>
      addSystemRoleToUserInTests(db, userId, tenantId, SYSTEM_ROLE_SLUGS.GROUP_MANAGER),
    );

  /** Seeds a completed quiz lesson with chapter, lesson and attempt progress for the learner. */
  const arrangeCompletedQuizProgress = (
    studentId: UUIDType,
    courseId: UUIDType,
    authorId: UUIDType,
  ) =>
    runInTenant(async () => {
      const completedAt = new Date().toISOString();
      const chapter = await createChapterFactory(db).create({
        courseId,
        authorId,
        displayOrder: 1,
        lessonCount: 1,
      });
      const lesson = await createLessonFactory(db).create({
        chapterId: chapter.id,
        type: LESSON_TYPES.QUIZ,
        thresholdScore: 0,
      });

      await createAssessmentAttemptFactory(db).create({
        lessonId: lesson.id,
        learnerId: studentId,
      });
      await createStudentChapterProgressFactory(db).create({
        studentId,
        courseId,
        chapterId: chapter.id,
        completedLessonCount: 1,
        completedAt,
        completedAsFreemium: true,
      });
      await createStudentLessonProgressFactory(db).create({
        studentId,
        chapterId: chapter.id,
        lessonId: lesson.id,
        completedQuestionCount: 1,
        quizScore: 100,
        attempts: 1,
        isQuizPassed: true,
        isStarted: true,
        completedAt,
        languageAnswered: SUPPORTED_LANGUAGES.EN,
      });

      return { chapter, lesson };
    });

  const arrangeOtherTenant = async () => {
    const dbAdmin = app.get<DatabasePg>(DB_ADMIN);
    const [existingTenant] = await dbAdmin
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.host, OTHER_TENANT_HOST));

    if (existingTenant) return existingTenant.id;

    const createdTenant = await createTenantFactory(dbAdmin).create({ host: OTHER_TENANT_HOST });

    return createdTenant.id;
  };

  /** Seeds a learner's certificate, with its course and author, inside a separate tenant. */
  const arrangeCertificateInOtherTenant = async () => {
    const otherTenantId = await arrangeOtherTenant();

    return app.get(TenantDbRunnerService).runWithTenant(otherTenantId, async () => {
      const userFactory = createUserFactory(db);
      const author = await userFactory.create({ tenantId: otherTenantId });
      const learner = await userFactory.create({ tenantId: otherTenantId });
      const course = await createCourseFactory(db).create({
        authorId: author.id,
        hasCertificate: true,
      });

      return createCertificateFactory(db).create({ userId: learner.id, courseId: course.id });
    });
  };

  const findCertificate = (certificateId: UUIDType) =>
    runInTenant(async () => {
      const [certificate] = await db
        .select()
        .from(certificates)
        .where(eq(certificates.id, certificateId));

      return certificate;
    });

  const findStudentCourse = (studentId: UUIDType, courseId: UUIDType) =>
    runInTenant(async () => {
      const [studentCourse] = await db
        .select()
        .from(studentCourses)
        .where(and(eq(studentCourses.studentId, studentId), eq(studentCourses.courseId, courseId)));

      return studentCourse;
    });

  const findStudentProgress = (studentId: UUIDType, lessonId: UUIDType, chapterId: UUIDType) =>
    runInTenant(async () => {
      const [lessonProgress] = await db
        .select()
        .from(studentLessonProgress)
        .where(
          and(
            eq(studentLessonProgress.studentId, studentId),
            eq(studentLessonProgress.lessonId, lessonId),
          ),
        );
      const [chapterProgress] = await db
        .select()
        .from(studentChapterProgress)
        .where(
          and(
            eq(studentChapterProgress.studentId, studentId),
            eq(studentChapterProgress.chapterId, chapterId),
          ),
        );
      const attempts = await db
        .select()
        .from(assessmentAttempts)
        .where(eq(assessmentAttempts.learnerId, studentId));

      return { lessonProgress, chapterProgress, attempts };
    });

  const findActivityLogs = (actionType: ActivityLogActionType) =>
    runInTenant(() =>
      db.select().from(activityLogs).where(eq(activityLogs.actionType, actionType)),
    );

  /** Activity logs are written by a queue worker, so this polls until the expected count appears. */
  const waitForActivityLogs = (actionType: ActivityLogActionType, expectedCount = 1) =>
    waitForOutbox(
      app,
      () => findActivityLogs(actionType),
      (logs) => logs.length >= expectedCount,
    );

  return {
    ...enrollmentHelpers,
    arrangeCertificateCourse,
    arrangeCertificate,
    arrangeArchivedCertificate,
    arrangeEnrollment,
    arrangeManagedGroup,
    arrangeLearner,
    arrangeSignedInLearner,
    arrangeSignedInGroupManager,
    arrangeGroupManagerRole,
    arrangeCompletedQuizProgress,
    arrangeCertificateInOtherTenant,
    findCertificate,
    findStudentCourse,
    findStudentProgress,
    waitForActivityLogs,
  };
};
