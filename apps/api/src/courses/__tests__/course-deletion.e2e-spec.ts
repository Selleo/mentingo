import { COURSE_STATUSES, LESSON_TYPES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq, inArray } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { courses, scormPackages } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createLessonFactory } from "../../../test/factory/lesson.factory";
import { createScormPackageFactory } from "../../../test/factory/scorm-package.factory";
import {
  COURSE_AUTHORING_TABLES,
  createCourseAuthoringHelpers,
} from "../../../test/helpers/course-authoring";
import { createCourseEnrollmentHelpers } from "../../../test/helpers/course-enrollment";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  COURSE_DELETION_REQUESTS,
  PROTECTED_COURSE_DELETE_MESSAGE,
  PROTECTED_COURSE_STATUSES,
} from "./course-deletion.scenarios";

import type { CourseDeletionRequest } from "./course-deletion.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { CourseStatus } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { SignedInUser } from "test/helpers/course-enrollment";

const cacheManagerMock = { get: jest.fn(), set: jest.fn() };

describe("Course deletion (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let enrollmentHelpers: ReturnType<typeof createCourseEnrollmentHelpers>;
  let authoringHelpers: ReturnType<typeof createCourseAuthoringHelpers>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [{ provide: "CACHE_MANAGER", useValue: cacheManagerMock }],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    enrollmentHelpers = createCourseEnrollmentHelpers({ app, db, runInTenant });
    authoringHelpers = createCourseAuthoringHelpers({ db, runInTenant });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, COURSE_AUTHORING_TABLES);

    Object.values(cacheManagerMock).forEach((mock) => mock.mockReset());
    cacheManagerMock.get.mockResolvedValue("");
    cacheManagerMock.set.mockResolvedValue("");

    await enrollmentHelpers.arrangeGlobalSettings();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, COURSE_AUTHORING_TABLES);
  });

  const deleteCourse = (admin: SignedInUser, courseId: UUIDType, expectedStatus = 200) =>
    request(app.getHttpServer())
      .delete(`/api/course/deleteCourse/${courseId}`)
      .set("Cookie", admin.cookies)
      .expect(expectedStatus);

  const deleteManyCourses = (admin: SignedInUser, courseIds: UUIDType[], expectedStatus = 200) =>
    request(app.getHttpServer())
      .delete("/api/course/deleteManyCourses")
      .send({ ids: courseIds })
      .set("Cookie", admin.cookies)
      .expect(expectedStatus);

  const sendDeletion = (
    deletionRequest: CourseDeletionRequest,
    admin: SignedInUser,
    courseId: UUIDType,
  ) =>
    match(deletionRequest)
      .with(COURSE_DELETION_REQUESTS.SINGLE, () => deleteCourse(admin, courseId))
      .with(COURSE_DELETION_REQUESTS.MANY, () => deleteManyCourses(admin, [courseId]))
      .exhaustive();

  const arrangeAdminWithCourses = async (statuses: CourseStatus[]) => {
    const admin = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
    const adminCourses = [];

    for (const status of statuses) {
      adminCourses.push(await authoringHelpers.arrangeCourse({ authorId: admin.user.id, status }));
    }

    return { admin, courses: adminCourses };
  };

  const findCourseIds = (courseIds: UUIDType[]) =>
    runInTenant(async () => {
      const rows = await db
        .select({ id: courses.id })
        .from(courses)
        .where(inArray(courses.id, courseIds));

      return rows.map(({ id }) => id);
    });

  const arrangeScormLesson = (courseId: UUIDType, authorId: UUIDType) =>
    runInTenant(async () => {
      const chapter = await createChapterFactory(db).create({ courseId, authorId });
      const lesson = await createLessonFactory(db).create({
        chapterId: chapter.id,
        type: LESSON_TYPES.SCORM,
        displayOrder: 0,
      });

      return createScormPackageFactory(db).create({ entityId: lesson.id });
    });

  const findScormPackageIds = (scormPackageId: UUIDType) =>
    runInTenant(async () => {
      const rows = await db
        .select({ id: scormPackages.id })
        .from(scormPackages)
        .where(eq(scormPackages.id, scormPackageId));

      return rows.map(({ id }) => id);
    });

  describe.each(Object.values(COURSE_DELETION_REQUESTS))("%s", (deletionRequest) => {
    it("clears the featured course when it is deleted", async () => {
      const {
        admin,
        courses: [course],
      } = await arrangeAdminWithCourses([COURSE_STATUSES.DRAFT]);
      await authoringHelpers.featureCourse(course.id);

      await sendDeletion(deletionRequest, admin, course.id);

      expect(await authoringHelpers.findFeaturedCourseId()).toBeUndefined();
    });

    it("removes the SCORM packages of the course lessons", async () => {
      const {
        admin,
        courses: [course],
      } = await arrangeAdminWithCourses([COURSE_STATUSES.DRAFT]);
      const scormPackage = await arrangeScormLesson(course.id, admin.user.id);

      await sendDeletion(deletionRequest, admin, course.id);

      expect(await findScormPackageIds(scormPackage.id)).toEqual([]);
    });
  });

  describe("DELETE /api/course/deleteCourse/:id", () => {
    it("deletes a draft course", async () => {
      const {
        admin,
        courses: [course],
      } = await arrangeAdminWithCourses([COURSE_STATUSES.DRAFT]);

      await deleteCourse(admin, course.id);

      expect(await findCourseIds([course.id])).toEqual([]);
    });

    it.each(PROTECTED_COURSE_STATUSES)("keeps a $status course", async ({ status }) => {
      const {
        admin,
        courses: [course],
      } = await arrangeAdminWithCourses([status]);

      const response = await deleteCourse(admin, course.id, 403);

      expect(response.body.message).toBe(PROTECTED_COURSE_DELETE_MESSAGE);
      expect(await findCourseIds([course.id])).toEqual([course.id]);
    });
  });

  describe("DELETE /api/course/deleteManyCourses", () => {
    it("deletes every selected draft course", async () => {
      const { admin, courses: draftCourses } = await arrangeAdminWithCourses([
        COURSE_STATUSES.DRAFT,
        COURSE_STATUSES.DRAFT,
      ]);
      const courseIds = draftCourses.map(({ id }) => id);

      await deleteManyCourses(admin, courseIds);

      expect(await findCourseIds(courseIds)).toEqual([]);
    });

    it("keeps the whole selection when it includes a private course", async () => {
      const { admin, courses: selectedCourses } = await arrangeAdminWithCourses([
        COURSE_STATUSES.DRAFT,
        COURSE_STATUSES.PRIVATE,
      ]);
      const courseIds = selectedCourses.map(({ id }) => id);

      const response = await deleteManyCourses(admin, courseIds, 403);

      expect(response.body.message).toBe(PROTECTED_COURSE_DELETE_MESSAGE);
      expect(await findCourseIds(courseIds)).toEqual(expect.arrayContaining(courseIds));
    });
  });
});
