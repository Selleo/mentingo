import { faker } from "@faker-js/faker";
import { COURSE_ENROLLMENT, COURSE_STATUSES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";
import { match } from "ts-pattern";

import { CourseService } from "src/courses/course.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createStudentCourseFactory } from "../../../test/factory/student-course.factory";
import {
  COURSE_AUTHORING_TABLES,
  createCourseAuthoringHelpers,
} from "../../../test/helpers/course-authoring";
import { createCourseEnrollmentHelpers } from "../../../test/helpers/course-enrollment";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  BULK_ACTIONS,
  BULK_ACTOR_REJECTIONS,
  BULK_ACTORS,
  BULK_SELECTIONS,
  CONTENT_CREATOR_ALLOWED_BULK_CASES,
  CONTENT_CREATOR_FORBIDDEN_BULK_CASES,
  INVALID_BULK_ARCHIVE_PAYLOADS,
} from "./course-bulk-actions.scenarios";

import type { BulkAction, BulkActor, BulkSelection } from "./course-bulk-actions.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { SignedInUser } from "test/helpers/course-enrollment";

const cacheManagerMock = { get: jest.fn(), set: jest.fn() };

const BULK_ACTION_PATHS = {
  ARCHIVE: "/api/course/bulk/archive",
  STATUS: "/api/course/bulk/status",
  CATEGORY: "/api/course/bulk/category",
} as const;

describe("Course bulk actions (e2e)", () => {
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

  const sendBulkRequest =
    (path: string) =>
    (body: Record<string, unknown>, cookies: string, expectedStatus = 200) =>
      request(app.getHttpServer())
        .patch(path)
        .set("Cookie", cookies)
        .send(body)
        .expect(expectedStatus);

  const sendBulkArchive = sendBulkRequest(BULK_ACTION_PATHS.ARCHIVE);
  const sendBulkStatus = sendBulkRequest(BULK_ACTION_PATHS.STATUS);
  const sendBulkCategory = sendBulkRequest(BULK_ACTION_PATHS.CATEGORY);

  const sendBulkAction = ({
    action,
    ids,
    targetCategoryId,
    cookies,
    expectedStatus,
  }: {
    action: BulkAction;
    ids: UUIDType[];
    targetCategoryId: UUIDType;
    cookies: string;
    expectedStatus: number;
  }) =>
    match(action)
      .with(BULK_ACTIONS.ARCHIVE, () =>
        sendBulkArchive({ ids, isArchived: true }, cookies, expectedStatus),
      )
      .with(BULK_ACTIONS.STATUS, () =>
        sendBulkStatus({ ids, status: COURSE_STATUSES.PRIVATE }, cookies, expectedStatus),
      )
      .with(BULK_ACTIONS.CATEGORY, () =>
        sendBulkCategory({ ids, categoryId: targetCategoryId }, cookies, expectedStatus),
      )
      .exhaustive();

  const expectedChangeFor = (action: BulkAction, targetCategoryId: UUIDType) =>
    match(action)
      .with(BULK_ACTIONS.ARCHIVE, () => ({ isArchived: true }))
      .with(BULK_ACTIONS.STATUS, () => ({ status: COURSE_STATUSES.PRIVATE }))
      .with(BULK_ACTIONS.CATEGORY, () => ({ categoryId: targetCategoryId }))
      .exhaustive();

  const arrangeSignedInAdmin = () => enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);

  const arrangeAdminCourse = async (
    overrides: Parameters<typeof authoringHelpers.arrangeCourse>[0],
  ) => {
    const admin = await arrangeSignedInAdmin();
    const course = await authoringHelpers.arrangeCourse({ authorId: admin.user.id, ...overrides });

    return { admin, course };
  };

  const arrangeActorCookies = async (actor: BulkActor) =>
    match(actor)
      .with(BULK_ACTORS.ANONYMOUS, async () => "")
      .with(BULK_ACTORS.STUDENT, async () => {
        const student = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);

        return student.cookies;
      })
      .exhaustive();

  const selectCourseIds = (
    selection: BulkSelection,
    ownCourseId: UUIDType,
    foreignCourseId: UUIDType,
  ) =>
    match(selection)
      .with(BULK_SELECTIONS.OWN_COURSE, () => [ownCourseId])
      .with(BULK_SELECTIONS.OWN_COURSE_TWICE, () => [ownCourseId, ownCourseId])
      .with(BULK_SELECTIONS.OWN_AND_FOREIGN_COURSES, () => [ownCourseId, foreignCourseId])
      .with(BULK_SELECTIONS.MISSING_COURSE, () => [faker.string.uuid()])
      .exhaustive();

  describe("bulk action access", () => {
    const actorRejectionCases = Object.values(BULK_ACTIONS).flatMap((action) =>
      BULK_ACTOR_REJECTIONS.map((rejection) => ({ action, ...rejection })),
    );

    const arrangeContentCreatorSelection = async () => {
      const contentCreator = await enrollmentHelpers.arrangeSignedInUser(
        SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
      );
      const otherAuthor = await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const ownCourse = await authoringHelpers.arrangeCourse({
        authorId: contentCreator.user.id,
        status: COURSE_STATUSES.DRAFT,
      });
      const foreignCourse = await authoringHelpers.arrangeCourse({
        authorId: otherAuthor.id,
        status: COURSE_STATUSES.DRAFT,
      });
      const targetCategory = await authoringHelpers.arrangeCategory();

      return { contentCreator, ownCourse, foreignCourse, targetCategory };
    };

    it.each(actorRejectionCases)(
      "$action responds $expectedStatus to $actor",
      async ({ action, actor, expectedStatus }) => {
        const { course } = await arrangeAdminCourse({ status: COURSE_STATUSES.DRAFT });
        const targetCategory = await authoringHelpers.arrangeCategory();
        const cookies = await arrangeActorCookies(actor);
        const statesBefore = await authoringHelpers.findCourseStates([course.id]);

        await sendBulkAction({
          action,
          ids: [course.id],
          targetCategoryId: targetCategory.id,
          cookies,
          expectedStatus,
        });

        expect(await authoringHelpers.findCourseStates([course.id])).toEqual(statesBefore);
      },
    );

    it.each(CONTENT_CREATOR_ALLOWED_BULK_CASES)(
      "$action lets a content creator select $selection",
      async ({ action, selection }) => {
        const { contentCreator, ownCourse, foreignCourse, targetCategory } =
          await arrangeContentCreatorSelection();

        await sendBulkAction({
          action,
          ids: selectCourseIds(selection, ownCourse.id, foreignCourse.id),
          targetCategoryId: targetCategory.id,
          cookies: contentCreator.cookies,
          expectedStatus: 200,
        });

        expect(await authoringHelpers.findCourse(ownCourse.id)).toMatchObject(
          expectedChangeFor(action, targetCategory.id),
        );
      },
    );

    it.each(CONTENT_CREATOR_FORBIDDEN_BULK_CASES)(
      "$action forbids a content creator to select $selection",
      async ({ action, selection, expectedMessage }) => {
        const { contentCreator, ownCourse, foreignCourse, targetCategory } =
          await arrangeContentCreatorSelection();
        const seededCourseIds = [ownCourse.id, foreignCourse.id];
        const statesBefore = await authoringHelpers.findCourseStates(seededCourseIds);

        const response = await sendBulkAction({
          action,
          ids: selectCourseIds(selection, ownCourse.id, foreignCourse.id),
          targetCategoryId: targetCategory.id,
          cookies: contentCreator.cookies,
          expectedStatus: 403,
        });

        expect(response.body.message).toBe(expectedMessage);
        expect(await authoringHelpers.findCourseStates(seededCourseIds)).toEqual(
          expect.arrayContaining(statesBefore),
        );
      },
    );
  });

  describe("PATCH /api/course/bulk/archive", () => {
    it.each(INVALID_BULK_ARCHIVE_PAYLOADS)("rejects a payload with $problem", async ({ body }) => {
      const admin = await arrangeSignedInAdmin();

      await sendBulkArchive(body, admin.cookies, 400);
    });

    it("archives the courses but keeps their publication status", async () => {
      const { admin, course } = await arrangeAdminCourse({ status: COURSE_STATUSES.PUBLISHED });

      await sendBulkArchive({ ids: [course.id], isArchived: true }, admin.cookies);

      expect(await authoringHelpers.findCourseStates([course.id])).toEqual([
        {
          id: course.id,
          status: COURSE_STATUSES.PUBLISHED,
          isArchived: true,
          categoryId: course.categoryId,
        },
      ]);
    });

    it("clears the featured course when it is archived", async () => {
      const { admin, course } = await arrangeAdminCourse({ status: COURSE_STATUSES.PUBLISHED });
      await authoringHelpers.featureCourse(course.id);

      await sendBulkArchive({ ids: [course.id], isArchived: true }, admin.cookies);

      expect(await authoringHelpers.findFeaturedCourseId()).toBeUndefined();
    });

    it("restores an archived course with its previous status", async () => {
      const { admin, course } = await arrangeAdminCourse({
        status: COURSE_STATUSES.PUBLISHED,
        isArchived: true,
      });

      await sendBulkArchive({ ids: [course.id], isArchived: false }, admin.cookies);

      expect(await authoringHelpers.findCourse(course.id)).toMatchObject({
        status: COURSE_STATUSES.PUBLISHED,
        isArchived: false,
      });
    });

    it("accepts restoring a course that is not archived", async () => {
      const { admin, course } = await arrangeAdminCourse({ status: COURSE_STATUSES.PUBLISHED });

      await sendBulkArchive({ ids: [course.id], isArchived: false }, admin.cookies);

      expect(await authoringHelpers.findCourse(course.id)).toMatchObject({
        status: COURSE_STATUSES.PUBLISHED,
        isArchived: false,
      });
    });

    it("keeps the archive flag when the status changes in bulk", async () => {
      const { admin, course } = await arrangeAdminCourse({ status: COURSE_STATUSES.PUBLISHED });

      await sendBulkArchive({ ids: [course.id], isArchived: true }, admin.cookies);
      await sendBulkStatus({ ids: [course.id], status: COURSE_STATUSES.DRAFT }, admin.cookies);

      expect(await authoringHelpers.findCourse(course.id)).toMatchObject({
        status: COURSE_STATUSES.DRAFT,
        isArchived: true,
      });
    });

    describe("an archived course", () => {
      const arrangeArchivedCourse = async () => {
        const { admin, course } = await arrangeAdminCourse({ status: COURSE_STATUSES.PUBLISHED });
        await sendBulkArchive({ ids: [course.id], isArchived: true }, admin.cookies);

        return { admin, course };
      };

      const listCourseIds = async (admin: SignedInUser, isArchived?: boolean | "all") => {
        const response = await request(app.getHttpServer())
          .get("/api/course/all")
          .query({ language: "en", ...(isArchived !== undefined && { isArchived }) })
          .set("Cookie", admin.cookies)
          .expect(200);

        return response.body.data.map(({ id }: { id: UUIDType }) => id);
      };

      const lookUpCourse = (learner: SignedInUser, courseId: UUIDType, expectedStatus: number) =>
        request(app.getHttpServer())
          .get("/api/course/lookup")
          .query({ id: courseId, language: "en" })
          .set("Cookie", learner.cookies)
          .expect(expectedStatus);

      it("is listed for admins only when archived courses are requested", async () => {
        const { admin, course } = await arrangeArchivedCourse();

        expect({
          default: await listCourseIds(admin),
          archived: await listCourseIds(admin, true),
          all: await listCourseIds(admin, "all"),
        }).toEqual({
          default: [],
          archived: [course.id],
          all: [course.id],
        });
      });

      it("is hidden from the public catalog", async () => {
        const { course } = await arrangeArchivedCourse();

        const response = await request(app.getHttpServer())
          .get("/api/course/available-courses")
          .query({ language: "en" })
          .expect(200);

        expect(response.body.data).not.toContainEqual(expect.objectContaining({ id: course.id }));
      });

      it("stays open to learners already enrolled", async () => {
        const { course } = await arrangeArchivedCourse();
        const enrolledLearner = await enrollmentHelpers.arrangeSignedInUser(
          SYSTEM_ROLE_SLUGS.STUDENT,
        );
        const otherLearner = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);
        await runInTenant(() =>
          createStudentCourseFactory(db).create({
            studentId: enrolledLearner.user.id,
            courseId: course.id,
          }),
        );

        const response = await lookUpCourse(enrolledLearner, course.id, 200);
        await lookUpCourse(otherLearner, course.id, 404);

        expect(response.body.data).toMatchObject({ status: "found" });
      });

      it("rejects self-enrollment", async () => {
        const { course } = await arrangeArchivedCourse();
        const learner = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);

        await request(app.getHttpServer())
          .post("/api/course/enroll-course")
          .query({ id: course.id })
          .set("Cookie", learner.cookies)
          .expect(403);

        expect(await enrollmentHelpers.findStudentEnrollment(learner.user.id, course.id)).toBe(
          undefined,
        );
      });

      it("still lets admins enroll students", async () => {
        const { admin, course } = await arrangeArchivedCourse();
        const student = await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);

        await request(app.getHttpServer())
          .post(`/api/course/${course.id}/enroll-courses`)
          .send({ studentIds: [student.id] })
          .set("Cookie", admin.cookies)
          .expect(201);

        expect(await enrollmentHelpers.findStudentEnrollment(student.id, course.id)).toMatchObject({
          status: COURSE_ENROLLMENT.ENROLLED,
        });
      });

      it("still enrolls a learner who completed a payment", async () => {
        const { course } = await arrangeArchivedCourse();
        const learner = await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);

        await runInTenant(() =>
          app.get(CourseService).enrollCourse(course.id, learner.id, undefined, "pi_paid"),
        );

        expect(await enrollmentHelpers.findStudentEnrollment(learner.id, course.id)).toMatchObject({
          status: COURSE_ENROLLMENT.ENROLLED,
          paymentId: "pi_paid",
        });
      });
    });
  });

  describe("PATCH /api/course/bulk/status", () => {
    it("changes the status of every selected course", async () => {
      const { admin, course } = await arrangeAdminCourse({ status: COURSE_STATUSES.DRAFT });
      const secondCourse = await authoringHelpers.arrangeCourse({
        authorId: admin.user.id,
        status: COURSE_STATUSES.DRAFT,
      });

      await sendBulkStatus(
        { ids: [course.id, secondCourse.id], status: COURSE_STATUSES.PRIVATE },
        admin.cookies,
      );

      expect(await authoringHelpers.findCourseStates([course.id, secondCourse.id])).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: course.id, status: COURSE_STATUSES.PRIVATE }),
          expect.objectContaining({ id: secondCourse.id, status: COURSE_STATUSES.PRIVATE }),
        ]),
      );
    });

    it("clears the featured course when it is unpublished", async () => {
      const { admin, course } = await arrangeAdminCourse({ status: COURSE_STATUSES.PUBLISHED });
      const secondCourse = await authoringHelpers.arrangeCourse({
        authorId: admin.user.id,
        status: COURSE_STATUSES.PUBLISHED,
      });
      await authoringHelpers.featureCourse(course.id);

      await sendBulkStatus(
        { ids: [course.id, secondCourse.id], status: COURSE_STATUSES.PRIVATE },
        admin.cookies,
      );

      expect(await authoringHelpers.findFeaturedCourseId()).toBeUndefined();
    });

    it("rejects an empty course selection", async () => {
      const admin = await arrangeSignedInAdmin();

      const response = await sendBulkStatus(
        { ids: [], status: COURSE_STATUSES.PRIVATE },
        admin.cookies,
        400,
      );

      expect(response.body.message).toBe("adminCoursesView.toast.noCoursesSelected");
    });

    it("rejects a status that is not a course status", async () => {
      const { admin, course } = await arrangeAdminCourse({ status: COURSE_STATUSES.DRAFT });

      await sendBulkStatus({ ids: [course.id], status: "archived" }, admin.cookies, 400);

      expect(await authoringHelpers.findCourse(course.id)).toMatchObject({
        status: COURSE_STATUSES.DRAFT,
      });
    });
  });

  describe("PATCH /api/course/bulk/category", () => {
    it("moves every selected course to the category", async () => {
      const { admin, course } = await arrangeAdminCourse({ status: COURSE_STATUSES.DRAFT });
      const secondCourse = await authoringHelpers.arrangeCourse({
        authorId: admin.user.id,
        status: COURSE_STATUSES.DRAFT,
      });
      const targetCategory = await authoringHelpers.arrangeCategory();

      await sendBulkCategory(
        { ids: [course.id, secondCourse.id], categoryId: targetCategory.id },
        admin.cookies,
      );

      expect(await authoringHelpers.findCourseStates([course.id, secondCourse.id])).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: course.id, categoryId: targetCategory.id }),
          expect.objectContaining({ id: secondCourse.id, categoryId: targetCategory.id }),
        ]),
      );
    });

    it("rejects a category that does not exist", async () => {
      const { admin, course } = await arrangeAdminCourse({ status: COURSE_STATUSES.DRAFT });

      const response = await sendBulkCategory(
        { ids: [course.id], categoryId: faker.string.uuid() },
        admin.cookies,
        404,
      );

      expect(response.body.message).toBe(
        "adminCoursesView.toast.bulkCategoryUpdateCategoryNotFound",
      );
    });

    it("rejects an empty course selection", async () => {
      const admin = await arrangeSignedInAdmin();
      const category = await authoringHelpers.arrangeCategory();

      const response = await sendBulkCategory(
        { ids: [], categoryId: category.id },
        admin.cookies,
        400,
      );

      expect(response.body.message).toBe("adminCoursesView.toast.noCoursesSelected");
    });
  });
});
