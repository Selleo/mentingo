import { CERTIFICATE_ARCHIVE_REASONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";
import { match } from "ts-pattern";

import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { CERTIFICATE_TABLES, createCertificateHelpers } from "../../../test/helpers/certificates";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  ANONYMOUS_LISTING_PATHS,
  COURSE_ROW_GROUP_FILTERS,
  COURSE_ROW_GROUP_FILTER_CASES,
  COURSE_ROW_REJECTIONS,
  COURSE_ROW_REJECTION_CASES,
  MISSING_CERTIFICATE_CASES,
  MISSING_CERTIFICATE_KINDS,
} from "./certificate-listing.scenarios";

import type {
  CourseRowGroupFilter,
  CourseRowRejection,
  MissingCertificateKind,
} from "./certificate-listing.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { SignedInUser } from "test/helpers/course-enrollment";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe("Certificate listing (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let helpers: ReturnType<typeof createCertificateHelpers>;

  beforeAll(async () => {
    const e2e = await createE2ETest({ useDbProxy: true });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    helpers = createCertificateHelpers({ app, db, runInTenant });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, CERTIFICATE_TABLES);
    await helpers.arrangeGlobalSettings();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, CERTIFICATE_TABLES);
  });

  const getAsUser = (user: SignedInUser, path: string, query: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .get(path)
      .set("Cookie", user.cookies)
      .query({ language: "en", ...query });

  const arrangeLearnerWithCourse = async (courseTitle = "Python Basics") => {
    const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
    const learner = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);
    const course = await helpers.arrangeCertificateCourse(admin.id, { title: courseTitle });

    return { admin, learner, course };
  };

  it.each(ANONYMOUS_LISTING_PATHS)("rejects an anonymous request to $path", async ({ path }) => {
    await request(app.getHttpServer()).get(path).expect(401);
  });

  describe("GET /api/certificates/all", () => {
    it("returns the learner's certificates with pagination metadata", async () => {
      const { learner, course } = await arrangeLearnerWithCourse();
      const expiresAt = "2026-06-30T23:59:59.999Z";
      const certificate = await helpers.arrangeCertificate({
        userId: learner.user.id,
        courseId: course.id,
        expiresAt,
      });

      const response = await getAsUser(learner, "/api/certificates/all", {
        userId: learner.user.id,
      }).expect(200);

      expect(response.body).toEqual({
        data: [
          expect.objectContaining({
            id: certificate.id,
            userId: learner.user.id,
            courseId: course.id,
            courseTitle: "Python Basics",
            fullName: `${learner.user.firstName} ${learner.user.lastName}`,
            completionDate: expect.any(String),
            issuedAt: expect.any(String),
            expiresAt: expect.any(String),
          }),
        ],
        pagination: { totalItems: 1, page: 1, perPage: DEFAULT_PAGE_SIZE },
      });
      expect(new Date(response.body.data[0].expiresAt)).toEqual(new Date(expiresAt));
    });

    it("leaves out archived certificates", async () => {
      const { learner, course } = await arrangeLearnerWithCourse();
      await helpers.arrangeArchivedCertificate(
        { userId: learner.user.id, courseId: course.id },
        CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
      );
      const activeCertificate = await helpers.arrangeCertificate({
        userId: learner.user.id,
        courseId: course.id,
      });

      const response = await getAsUser(learner, "/api/certificates/all", {
        userId: learner.user.id,
      }).expect(200);

      expect(response.body.data).toEqual([expect.objectContaining({ id: activeCertificate.id })]);
      expect(response.body.pagination.totalItems).toBe(1);
    });

    it("orders certificates from the oldest and pages through them", async () => {
      const { admin, learner, course: newerCourse } = await arrangeLearnerWithCourse();
      const olderCourse = await helpers.arrangeCertificateCourse(admin.id);
      await helpers.arrangeCertificate({
        userId: learner.user.id,
        courseId: newerCourse.id,
        createdAt: "2026-01-02T00:00:00.000Z",
      });
      await helpers.arrangeCertificate({
        userId: learner.user.id,
        courseId: olderCourse.id,
        createdAt: "2026-01-01T00:00:00.000Z",
      });

      const sortedResponse = await getAsUser(learner, "/api/certificates/all", {
        userId: learner.user.id,
        sort: "createdAt",
      }).expect(200);
      const secondPageResponse = await getAsUser(learner, "/api/certificates/all", {
        userId: learner.user.id,
        perPage: 1,
        page: 2,
      }).expect(200);

      expect(
        sortedResponse.body.data.map(({ courseId }: { courseId: UUIDType }) => courseId),
      ).toEqual([olderCourse.id, newerCourse.id]);
      expect(secondPageResponse.body.data).toEqual([
        expect.objectContaining({ courseId: newerCourse.id }),
      ]);
    });
  });

  describe("GET /api/certificates/certificate", () => {
    it("returns the learner's certificate for the course", async () => {
      const { learner, course } = await arrangeLearnerWithCourse();
      const certificate = await helpers.arrangeCertificate({
        userId: learner.user.id,
        courseId: course.id,
      });

      const response = await getAsUser(learner, "/api/certificates/certificate", {
        userId: learner.user.id,
        courseId: course.id,
      }).expect(200);

      expect(response.body).toMatchObject({
        id: certificate.id,
        userId: learner.user.id,
        courseId: course.id,
        courseTitle: "Python Basics",
        fullName: `${learner.user.firstName} ${learner.user.lastName}`,
        completionDate: expect.any(String),
        issuedAt: expect.any(String),
      });
    });

    const arrangeMissingCertificate = (
      kind: MissingCertificateKind,
      learnerId: UUIDType,
      courseId: UUIDType,
    ) =>
      match(kind)
        .with(MISSING_CERTIFICATE_KINDS.NEVER_ISSUED, async () => undefined)
        .with(MISSING_CERTIFICATE_KINDS.ARCHIVED, () =>
          helpers.arrangeArchivedCertificate(
            { userId: learnerId, courseId },
            CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
          ),
        )
        .exhaustive();

    it.each(MISSING_CERTIFICATE_CASES)(
      "returns an empty body when the certificate $kind",
      async ({ kind }) => {
        const { learner, course } = await arrangeLearnerWithCourse();
        await arrangeMissingCertificate(kind, learner.user.id, course.id);

        const response = await getAsUser(learner, "/api/certificates/certificate", {
          userId: learner.user.id,
          courseId: course.id,
        }).expect(200);

        expect(response.body).toEqual({});
      },
    );
  });

  describe("GET /api/certificates/dashboard", () => {
    it("returns only certificates owned by the signed-in learner", async () => {
      const { learner, course } = await arrangeLearnerWithCourse();
      const otherLearner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      await helpers.arrangeCertificate({ userId: learner.user.id, courseId: course.id });
      await helpers.arrangeCertificate({ userId: otherLearner.id, courseId: course.id });

      const response = await getAsUser(learner, "/api/certificates/dashboard").expect(200);

      expect(response.body).toMatchObject({
        data: [expect.objectContaining({ userId: learner.user.id })],
        pagination: { totalItems: 1 },
      });
    });
  });

  describe("GET /api/certificates/dashboard-summary", () => {
    it("counts active certificates and points to the one expiring soonest", async () => {
      const { admin, learner, course } = await arrangeLearnerWithCourse("Expiring Soon");
      const laterCourse = await helpers.arrangeCertificateCourse(admin.id);
      const archivedCourse = await helpers.arrangeCertificateCourse(admin.id);
      const soonestExpiry = new Date(Date.now() + 3 * DAY_IN_MS).toISOString();
      const soonestCertificate = await helpers.arrangeCertificate({
        userId: learner.user.id,
        courseId: course.id,
        expiresAt: soonestExpiry,
      });
      await helpers.arrangeCertificate({
        userId: learner.user.id,
        courseId: laterCourse.id,
        expiresAt: new Date(Date.now() + 20 * DAY_IN_MS).toISOString(),
      });
      await helpers.arrangeArchivedCertificate(
        { userId: learner.user.id, courseId: archivedCourse.id },
        CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
      );

      const response = await getAsUser(learner, "/api/certificates/dashboard-summary").expect(200);

      expect(response.body.data).toEqual({
        activeCount: 2,
        expiringSoon: {
          certificateId: soonestCertificate.id,
          courseId: course.id,
          courseSlug: course.id,
          courseTitle: "Expiring Soon",
          expiresAt: expect.any(String),
        },
      });
      expect(new Date(response.body.data.expiringSoon.expiresAt)).toEqual(new Date(soonestExpiry));
    });

    it("reports no expiring certificate when none expires within a month", async () => {
      const { learner, course } = await arrangeLearnerWithCourse();
      await helpers.arrangeCertificate({ userId: learner.user.id, courseId: course.id });

      const response = await getAsUser(learner, "/api/certificates/dashboard-summary").expect(200);

      expect(response.body.data).toEqual({ activeCount: 1, expiringSoon: null });
    });
  });

  describe("GET /api/certificates/course/:courseId", () => {
    const arrangeEnrolledCertificate = async (learnerId: UUIDType, courseId: UUIDType) => {
      await helpers.arrangeEnrollment(learnerId, courseId);

      return helpers.arrangeCertificate({ userId: learnerId, courseId });
    };

    it("returns every certificate row of the course to an administrator", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await helpers.arrangeCertificateCourse(admin.user.id);
      const firstLearner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const secondLearner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      await arrangeEnrolledCertificate(firstLearner.id, course.id);
      await arrangeEnrolledCertificate(secondLearner.id, course.id);

      const response = await getAsUser(admin, `/api/certificates/course/${course.id}`).expect(200);

      expect(response.body.data).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({ learnerEmail: firstLearner.email, previewAllowed: true }),
          expect.objectContaining({ learnerEmail: secondLearner.email, previewAllowed: true }),
        ]),
        pagination: { totalItems: 2 },
      });
    });

    it("lists the certificates to an administrator who also manages groups", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      await helpers.arrangeGroupManagerRole(admin.user.id, admin.user.tenantId);
      const course = await helpers.arrangeCertificateCourse(admin.user.id);
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const certificate = await arrangeEnrolledCertificate(learner.id, course.id);

      const response = await getAsUser(admin, `/api/certificates/course/${course.id}`).expect(200);

      expect(response.body.data.data).toEqual([
        expect.objectContaining({ certificateId: certificate.id }),
      ]);
    });

    it.each(COURSE_ROW_GROUP_FILTER_CASES)(
      "filters rows by $groupFilter",
      async ({ groupFilter, expectedRowCount }) => {
        const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const course = await helpers.arrangeCertificateCourse(admin.user.id);
        const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
        await arrangeEnrolledCertificate(learner.id, course.id);
        const group = await match<CourseRowGroupFilter>(groupFilter)
          .with(COURSE_ROW_GROUP_FILTERS.EMPTY_GROUP, () => helpers.arrangeGroupWithMembers([]))
          .with(COURSE_ROW_GROUP_FILTERS.LEARNER_GROUP, () =>
            helpers.arrangeGroupWithMembers([learner.id]),
          )
          .exhaustive();

        const response = await getAsUser(admin, `/api/certificates/course/${course.id}`, {
          groupId: group.id,
        }).expect(200);

        expect(response.body.data.pagination.totalItems).toBe(expectedRowCount);
        expect(response.body.data.data).toHaveLength(expectedRowCount);
      },
    );

    it("returns only learners of groups the group manager manages", async () => {
      const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const manager = await helpers.arrangeSignedInGroupManager();
      const course = await helpers.arrangeCertificateCourse(admin.id);
      const managedLearner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const unmanagedLearner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      await helpers.arrangeManagedGroup(manager.user.id, [managedLearner.id]);
      await helpers.arrangeGroupWithMembers([unmanagedLearner.id]);
      await arrangeEnrolledCertificate(managedLearner.id, course.id);
      await arrangeEnrolledCertificate(unmanagedLearner.id, course.id);

      const response = await getAsUser(manager, `/api/certificates/course/${course.id}`).expect(
        200,
      );

      expect(response.body.data.data).toEqual([
        expect.objectContaining({ learnerEmail: managedLearner.email }),
      ]);
    });

    const requestRowsRejectedFor = async (rejection: CourseRowRejection, courseId: UUIDType) =>
      match(rejection)
        .with(COURSE_ROW_REJECTIONS.ANONYMOUS_REQUESTER, () =>
          request(app.getHttpServer())
            .get(`/api/certificates/course/${courseId}`)
            .query({ language: "en" }),
        )
        .with(COURSE_ROW_REJECTIONS.STUDENT_REQUESTER, async () =>
          getAsUser(
            await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT),
            `/api/certificates/course/${courseId}`,
          ),
        )
        .with(COURSE_ROW_REJECTIONS.FOREIGN_AUTHOR, async () =>
          getAsUser(
            await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR),
            `/api/certificates/course/${courseId}`,
          ),
        )
        .exhaustive();

    it.each(COURSE_ROW_REJECTION_CASES)(
      "rejects with $expectedStatus when $rejection",
      async ({ rejection, expectedStatus, expectedBody }) => {
        const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const course = await helpers.arrangeCertificateCourse(admin.id);

        const response = await requestRowsRejectedFor(rejection, course.id);

        expect(response.status).toBe(expectedStatus);
        expect(response.body).toMatchObject(expectedBody);
      },
    );
  });
});
