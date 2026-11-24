import { faker } from "@faker-js/faker";
import { COURSE_ORIGIN_TYPES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { inArray } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { courseStudentsStats, coursesSummaryStats } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseStudentsStatsFactory } from "../../../test/factory/course-students-stats.factory";
import { createCourseSummaryStatsFactory } from "../../../test/factory/course-summary-stats.factory";
import {
  COURSE_AUTHORING_TABLES,
  createCourseAuthoringHelpers,
} from "../../../test/helpers/course-authoring";
import { createCourseEnrollmentHelpers } from "../../../test/helpers/course-enrollment";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  COURSE_OWNERSHIP_ACCESS_REJECTIONS,
  COURSE_OWNERSHIP_ACTORS,
  COURSE_OWNERSHIP_ENDPOINTS,
  OWNERSHIP_LOOKUP_REJECTION_CASES,
  OWNERSHIP_LOOKUP_REJECTIONS,
  OWNERSHIP_TRANSFER_REJECTION_CASES,
  OWNERSHIP_TRANSFER_REJECTIONS,
} from "./course-ownership.scenarios";

import type {
  CourseOwnershipActor,
  CourseOwnershipEndpoint,
  OwnershipLookupRejection,
  OwnershipTransferRejection,
} from "./course-ownership.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { UserWithCredentials } from "test/factory/user.factory";

const cacheManagerMock = { get: jest.fn(), set: jest.fn() };

describe("Course ownership (e2e)", () => {
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

  const getOwnership = (courseId: UUIDType, cookies: string, expectedStatus = 200) =>
    request(app.getHttpServer())
      .get(`/api/course/course-ownership/${courseId}`)
      .set("Cookie", cookies)
      .expect(expectedStatus);

  const transferOwnership = (
    courseId: UUIDType,
    userId: UUIDType,
    cookies: string,
    expectedStatus = 201,
  ) =>
    request(app.getHttpServer())
      .post("/api/course/course-ownership/transfer")
      .send({ courseId, userId })
      .set("Cookie", cookies)
      .expect(expectedStatus);

  const arrangeAuthoredCourse = async (
    overrides: Parameters<typeof authoringHelpers.arrangeCourse>[0] = {},
  ) => {
    const author = await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
    const course = await authoringHelpers.arrangeCourse({ authorId: author.id, ...overrides });

    return { author, course };
  };

  const arrangeCourseStatistics = (courseId: UUIDType, authorId: UUIDType) =>
    runInTenant(async () => {
      await createCourseSummaryStatsFactory(db).create({ courseId, authorId });
      await createCourseStudentsStatsFactory(db).create({ courseId, authorId });
    });

  const findStatisticsAuthors = (courseIds: UUIDType[]) =>
    runInTenant(async () => ({
      summary: await db
        .select({ courseId: coursesSummaryStats.courseId, authorId: coursesSummaryStats.authorId })
        .from(coursesSummaryStats)
        .where(inArray(coursesSummaryStats.courseId, courseIds)),
      students: await db
        .select({ courseId: courseStudentsStats.courseId, authorId: courseStudentsStats.authorId })
        .from(courseStudentsStats)
        .where(inArray(courseStudentsStats.courseId, courseIds)),
    }));

  const contactOf = (user: UserWithCredentials) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
  });

  describe("course ownership access", () => {
    const accessCases = Object.values(COURSE_OWNERSHIP_ENDPOINTS).flatMap((endpoint) =>
      COURSE_OWNERSHIP_ACCESS_REJECTIONS.map((rejection) => ({ endpoint, ...rejection })),
    );

    const arrangeActorCookies = (actor: CourseOwnershipActor) =>
      match(actor)
        .with(COURSE_OWNERSHIP_ACTORS.ANONYMOUS, async () => "")
        .with(COURSE_OWNERSHIP_ACTORS.CONTENT_CREATOR, async () => {
          const contentCreator = await enrollmentHelpers.arrangeSignedInUser(
            SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
          );

          return contentCreator.cookies;
        })
        .exhaustive();

    const sendOwnershipRequest = (
      endpoint: CourseOwnershipEndpoint,
      courseId: UUIDType,
      newOwnerId: UUIDType,
      cookies: string,
      expectedStatus: number,
    ) =>
      match(endpoint)
        .with(COURSE_OWNERSHIP_ENDPOINTS.GET, () => getOwnership(courseId, cookies, expectedStatus))
        .with(COURSE_OWNERSHIP_ENDPOINTS.TRANSFER, () =>
          transferOwnership(courseId, newOwnerId, cookies, expectedStatus),
        )
        .exhaustive();

    it.each(accessCases)(
      "$endpoint responds $expectedStatus to $actor",
      async ({ endpoint, actor, expectedStatus }) => {
        const { author, course } = await arrangeAuthoredCourse();
        const newOwner = await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
        const cookies = await arrangeActorCookies(actor);

        await sendOwnershipRequest(endpoint, course.id, newOwner.id, cookies, expectedStatus);

        expect(await authoringHelpers.findCourse(course.id)).toMatchObject({
          authorId: author.id,
        });
      },
    );
  });

  describe("GET /api/course/course-ownership/:courseId", () => {
    it("returns the current author and the users who could take the course over", async () => {
      const admin = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const { author, course } = await arrangeAuthoredCourse();
      const candidate = await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const student = await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);

      const response = await getOwnership(course.id, admin.cookies);

      expect(response.body.data.currentAuthor).toEqual(contactOf(author));
      expect(response.body.data.possibleCandidates).toEqual(
        expect.arrayContaining([contactOf(admin.user), contactOf(candidate)]),
      );
      expect(response.body.data.possibleCandidates).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: author.id })]),
      );
      expect(response.body.data.possibleCandidates).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: student.id })]),
      );
    });

    const arrangeLookupRejectionCourseId = async (rejection: OwnershipLookupRejection) =>
      match(rejection)
        .with(OWNERSHIP_LOOKUP_REJECTIONS.UNKNOWN_COURSE, async () => faker.string.uuid())
        .with(OWNERSHIP_LOOKUP_REJECTIONS.EXPORTED_COURSE, async () => {
          const { course } = await arrangeAuthoredCourse({
            originType: COURSE_ORIGIN_TYPES.EXPORTED,
          });

          return course.id;
        })
        .exhaustive();

    it.each(OWNERSHIP_LOOKUP_REJECTION_CASES)(
      "rejects the lookup when $rejection",
      async ({ rejection, expectedStatus, expectedMessage }) => {
        const admin = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const courseId = await arrangeLookupRejectionCourseId(rejection);

        const response = await getOwnership(courseId, admin.cookies, expectedStatus);

        expect(response.body.message).toBe(expectedMessage);
      },
    );
  });

  describe("POST /api/course/course-ownership/transfer", () => {
    it("hands the course and its statistics over to the new owner", async () => {
      const admin = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const { author, course } = await arrangeAuthoredCourse();
      const { author: otherAuthor, course: otherCourse } = await arrangeAuthoredCourse();
      const newOwner = await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      await arrangeCourseStatistics(course.id, author.id);
      await arrangeCourseStatistics(otherCourse.id, otherAuthor.id);

      await transferOwnership(course.id, newOwner.id, admin.cookies);

      expect(await authoringHelpers.findCourse(course.id)).toMatchObject({
        authorId: newOwner.id,
        authorMetadata: {
          authorId: newOwner.id,
          firstName: newOwner.firstName,
          lastName: newOwner.lastName,
        },
      });
      expect(await authoringHelpers.findCourse(otherCourse.id)).toMatchObject({
        authorId: otherAuthor.id,
      });
      expect(await findStatisticsAuthors([course.id, otherCourse.id])).toEqual({
        summary: expect.arrayContaining([
          { courseId: course.id, authorId: newOwner.id },
          { courseId: otherCourse.id, authorId: otherAuthor.id },
        ]),
        students: expect.arrayContaining([
          { courseId: course.id, authorId: newOwner.id },
          { courseId: otherCourse.id, authorId: otherAuthor.id },
        ]),
      });
    });

    const arrangeTransferRejection = async (rejection: OwnershipTransferRejection) =>
      match(rejection)
        .with(OWNERSHIP_TRANSFER_REJECTIONS.NOT_A_CANDIDATE, async () => ({
          ...(await arrangeAuthoredCourse()),
          newOwner: await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT),
        }))
        .with(OWNERSHIP_TRANSFER_REJECTIONS.EXPORTED_COURSE, async () => ({
          ...(await arrangeAuthoredCourse({ originType: COURSE_ORIGIN_TYPES.EXPORTED })),
          newOwner: await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR),
        }))
        .exhaustive();

    it.each(OWNERSHIP_TRANSFER_REJECTION_CASES)(
      "keeps the author when $rejection",
      async ({ rejection, expectedStatus, expectedMessage }) => {
        const admin = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const { author, course, newOwner } = await arrangeTransferRejection(rejection);

        const response = await transferOwnership(
          course.id,
          newOwner.id,
          admin.cookies,
          expectedStatus,
        );

        expect(response.body.message).toBe(expectedMessage);
        expect(await authoringHelpers.findCourse(course.id)).toMatchObject({
          authorId: author.id,
        });
      },
    );
  });
});
