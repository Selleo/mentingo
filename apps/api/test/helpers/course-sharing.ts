import { faker } from "@faker-js/faker";
import { COURSE_STATUSES, SYSTEM_ROLE_SLUGS, TENANT_STATUSES } from "@repo/shared";
import { and, desc, eq } from "drizzle-orm";
import request from "supertest";

import { COURSE_TRANSFER_JOB_TARGETS } from "src/course-transfer/course-transfer.constants";
import { CourseTransferService } from "src/course-transfer/services/course-transfer.service";
import { DB_ADMIN as DB_ADMIN_TOKEN } from "src/storage/db/db.providers";
import {
  chapters,
  courseTransferOperations,
  courseTransferStreams,
  courses,
  lessons,
  masterCourseExports,
  tenants,
} from "src/storage/schema";

import { createCategoryFactory } from "../factory/category.factory";
import { createChapterFactory } from "../factory/chapter.factory";
import { createCourseFactory } from "../factory/course.factory";
import { createLessonFactory } from "../factory/lesson.factory";
import { createSettingsFactory } from "../factory/settings.factory";
import { createUserFactory } from "../factory/user.factory";

import { DEFAULT_TEST_TENANT_HOST } from "./tenant-helpers";
import { cookieFor } from "./test-helpers";
import { waitForOutbox } from "./wait-for-outbox";

import type { truncateTables } from "./test-helpers";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { CourseTransferKind } from "src/course-transfer/course-transfer.types";
import type { LessonTest } from "test/factory/lesson.factory";
import type { UserWithCredentials } from "test/factory/user.factory";

export const SOURCE_TENANT_HOST = DEFAULT_TEST_TENANT_HOST;
export const TARGET_TENANT_HOST = "https://tenant-2.local";
export const SHARING_ADMIN_PASSWORD = "Password123@";

export const COURSE_SHARING_TABLES: Parameters<typeof truncateTables>[1] = [
  "outbox_events",
  "course_transfer_dependencies",
  "course_transfer_operations",
  "course_transfer_streams",
  "hosted_videos",
  "learning_path_entity_map",
  "learning_path_exports",
  "learning_path_courses",
  "learning_paths",
  "master_course_entity_map",
  "master_course_exports",
  "resource_entity",
  "resources",
  "assessment_question_choice_options",
  "assessment_questions",
  "assessments",
  "student_learning_path_courses",
  "student_learning_paths",
  "student_lesson_progress",
  "student_chapter_progress",
  "student_courses",
  "lessons",
  "chapters",
  "courses_summary_stats",
  "courses",
  "categories",
  "credentials",
  "user_onboarding",
  "users",
  "settings",
];

export type SharingTenant = { id: UUIDType; host: string };

export type RunAsTenant = <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>;

type TransferJobStatus = { state: string; failedReason: string | null };

/** Makes the default tenant the managing source and makes sure an active target tenant exists. */
export async function prepareSharingTenants(
  dbAdmin: DatabasePg,
  sourceTenantId: UUIDType,
): Promise<{ source: SharingTenant; target: SharingTenant }> {
  await dbAdmin
    .update(tenants)
    .set({ name: "Source Managing Tenant", host: SOURCE_TENANT_HOST, isManaging: true })
    .where(eq(tenants.id, sourceTenantId));

  const [existingTarget] = await dbAdmin
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.host, TARGET_TENANT_HOST))
    .limit(1);

  const targetTenantId = existingTarget
    ? existingTarget.id
    : (
        await dbAdmin
          .insert(tenants)
          .values({ name: "Target Tenant", host: TARGET_TENANT_HOST, isManaging: false })
          .returning({ id: tenants.id })
      )[0].id;

  await dbAdmin
    .update(tenants)
    .set({ name: "Target Tenant", isManaging: false, status: TENANT_STATUSES.ACTIVE })
    .where(eq(tenants.id, targetTenantId));

  return {
    source: { id: sourceTenantId, host: SOURCE_TENANT_HOST },
    target: { id: targetTenantId, host: TARGET_TENANT_HOST },
  };
}

export async function setTenantStatus(
  dbAdmin: DatabasePg,
  tenantId: UUIDType,
  status: (typeof TENANT_STATUSES)[keyof typeof TENANT_STATUSES],
) {
  await dbAdmin.update(tenants).set({ status }).where(eq(tenants.id, tenantId));
}

export async function createGlobalSettingsForTenants(
  db: DatabasePg,
  runAsTenant: RunAsTenant,
  sharingTenants: SharingTenant[],
) {
  const settingsFactory = createSettingsFactory(db);

  for (const tenant of sharingTenants) {
    await runAsTenant(tenant.id, () => settingsFactory.create({ userId: null }));
  }
}

export type TenantHttpClient = ReturnType<typeof createTenantHttpClient>;

/** Sends requests as a signed-in user of one tenant, which the API resolves from the referer. */
export function createTenantHttpClient(
  app: INestApplication,
  tenant: SharingTenant,
  cookie: string[] = [],
) {
  const server = app.getHttpServer();
  const asTenantUser = (pendingRequest: request.Test) =>
    pendingRequest.set("Referer", `${tenant.host}/`).set("Cookie", cookie);

  return {
    get: (path: string) => asTenantUser(request(server).get(path)),
    post: (path: string) => asTenantUser(request(server).post(path)),
    patch: (path: string) => asTenantUser(request(server).patch(path)),
    delete: (path: string) => asTenantUser(request(server).delete(path)),
  };
}

export async function signInAsTenantAdmin(params: {
  app: INestApplication;
  db: DatabasePg;
  runAsTenant: RunAsTenant;
  tenant: SharingTenant;
}): Promise<{ admin: UserWithCredentials; http: TenantHttpClient }> {
  const { app, db, runAsTenant, tenant } = params;

  const admin = await runAsTenant(tenant.id, () =>
    createUserFactory(db)
      .withCredentials({ password: SHARING_ADMIN_PASSWORD })
      .withAdminSettings(db)
      .create({
        email: `admin+${faker.string.alphanumeric(8)}@example.com`,
        role: SYSTEM_ROLE_SLUGS.ADMIN,
        tenantId: tenant.id,
      }),
  );

  const cookie = keepAccessTokenCookie(await cookieFor(admin, app, tenant.host));
  return { admin, http: createTenantHttpClient(app, tenant, cookie) };
}

/** Keeps only the access token, so a refresh cookie cannot switch the session's tenant. */
function keepAccessTokenCookie(cookieHeader: string): string[] {
  const cookies = cookieHeader.split("; ");
  const accessTokenCookie = cookies.find((cookie) => cookie.startsWith("access_token="));
  return accessTokenCookie ? [accessTokenCookie] : cookies;
}

/**
 * Dispatches outbox events until the transfer job endpoint reports completion.
 * Throws as soon as the job fails, with the failure reason it reported.
 */
export async function waitForTransferJobToComplete(
  app: INestApplication,
  readJobStatus: () => Promise<TransferJobStatus>,
  timeoutMs?: number,
) {
  return waitForOutbox(
    app,
    readJobStatus,
    (job) => {
      if (job.state === "failed") {
        throw new Error(`Transfer job failed: ${job.failedReason ?? "unknown reason"}`);
      }
      return job.state === "completed";
    },
    timeoutMs,
  );
}

/**
 * Runs transfer operations in the test process, without the outbox or queue, so a test can
 * decide exactly which transfer runs when.
 */
export function createCourseTransferDriver(app: INestApplication, dbAdmin: DatabasePg) {
  const courseTransferService = app.get(CourseTransferService, { strict: false });

  const findLatestOperation = async (kind: CourseTransferKind, exportId: UUIDType) => {
    const [record] = await dbAdmin
      .select({ operation: courseTransferOperations, stream: courseTransferStreams })
      .from(courseTransferOperations)
      .innerJoin(
        courseTransferStreams,
        eq(courseTransferOperations.streamId, courseTransferStreams.id),
      )
      .where(
        and(eq(courseTransferStreams.kind, kind), eq(courseTransferStreams.exportId, exportId)),
      )
      .orderBy(desc(courseTransferOperations.revision))
      .limit(1);

    return record;
  };

  const transferOperation = async (operationId: string) => {
    const [record] = await dbAdmin
      .select({ operation: courseTransferOperations, stream: courseTransferStreams })
      .from(courseTransferOperations)
      .innerJoin(
        courseTransferStreams,
        eq(courseTransferOperations.streamId, courseTransferStreams.id),
      )
      .where(eq(courseTransferOperations.id, operationId));

    const { operation, stream } = record;
    const { sourceIdKey } = COURSE_TRANSFER_JOB_TARGETS[stream.kind];

    return courseTransferService.transferFromJob({
      kind: stream.kind,
      operationId,
      exportId: stream.exportId,
      sourceTenantId: stream.sourceTenantId,
      targetTenantId: stream.targetTenantId,
      sourceId: operation.payload[sourceIdKey] as UUIDType,
      payload: operation.payload,
    });
  };

  return { findLatestOperation, transferOperation };
}

export type SourceCourse = { courseId: UUIDType; chapterId: UUIDType; lessonId: UUIDType };

/** Creates a published course with one chapter and one lesson in the source tenant. */
export async function createSourceCourse(params: {
  db: DatabasePg;
  runAsTenant: RunAsTenant;
  tenant: SharingTenant;
  authorId: UUIDType;
  lesson?: Partial<LessonTest>;
}): Promise<SourceCourse> {
  const { db, runAsTenant, tenant, authorId } = params;

  return runAsTenant(tenant.id, async () => {
    const category = await createCategoryFactory(db).create();
    const course = await createCourseFactory(db).create({
      status: COURSE_STATUSES.PUBLISHED,
      authorId,
      categoryId: category.id,
      thumbnailS3Key: null,
      chapterCount: 1,
    });
    const chapter = await createChapterFactory(db).create({
      courseId: course.id,
      authorId,
      displayOrder: 1,
      lessonCount: 1,
    });
    const lesson = await createLessonFactory(db).create({
      chapterId: chapter.id,
      ...params.lesson,
    });

    return { courseId: course.id, chapterId: chapter.id, lessonId: lesson.id };
  });
}

/** Shares a course through the API and returns the accepted operation's job ID. */
export async function requestCourseExport(
  http: TenantHttpClient,
  courseId: UUIDType,
  targetTenantIds: UUIDType[],
): Promise<string> {
  const response = await http
    .post(`/api/course/master/${courseId}/export`)
    .send({ targetTenantIds })
    .expect(201);

  return response.body.data.jobs[0].reason as string;
}

/** Shares a course, runs the transfer to completion, and returns the recipient course. */
export async function exportCourseToTenant(
  app: INestApplication,
  http: TenantHttpClient,
  courseId: UUIDType,
  target: SharingTenant,
) {
  const jobId = await requestCourseExport(http, courseId, [target.id]);

  await waitForTransferJobToComplete(app, async () => {
    const response = await http.get(`/api/course/master/export-jobs/${jobId}`).expect(200);
    return response.body.data as TransferJobStatus;
  });

  return findCourseExport(app.get(DB_ADMIN_TOKEN), courseId, target.id);
}

export async function findCourseExport(
  dbAdmin: DatabasePg,
  sourceCourseId: UUIDType,
  targetTenantId: UUIDType,
) {
  const [courseExport] = await dbAdmin
    .select()
    .from(masterCourseExports)
    .where(
      and(
        eq(masterCourseExports.sourceCourseId, sourceCourseId),
        eq(masterCourseExports.targetTenantId, targetTenantId),
      ),
    );

  return courseExport;
}

/** Reads the lessons of a recipient course in the recipient tenant. */
export async function findTargetLessons(
  db: DatabasePg,
  runAsTenant: RunAsTenant,
  target: SharingTenant,
  targetCourseId: UUIDType,
) {
  return runAsTenant(target.id, () =>
    db
      .select({
        id: lessons.id,
        fileS3Key: lessons.fileS3Key,
        description: lessons.description,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(courses.id, targetCourseId)),
  );
}
