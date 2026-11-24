import { CERTIFICATE_STATUSES, COURSE_PROGRESS_STATUSES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq } from "drizzle-orm";
import { match } from "ts-pattern";

import { S3Service } from "src/s3/s3.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { courses } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { CERTIFICATE_TABLES, createCertificateHelpers } from "../../../test/helpers/certificates";
import { truncateTables } from "../../../test/helpers/test-helpers";
import { CertificatesService } from "../certificates.service";

import {
  CERTIFICATE_EXPIRY_CASES,
  COURSE_COMPLETED_AT,
  ISSUING_REJECTIONS,
  ISSUING_REJECTION_CASES,
} from "./certificate-issuing.scenarios";

import type { IssuingRejection } from "./certificate-issuing.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { CertificateValidity } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { CourseTest } from "test/factory/course.factory";

// Issuing schedules a background pre-render of share images, which the stored-image answer short-circuits.
const s3ServiceMock = {
  getFileExists: jest.fn(),
  getFileBuffer: jest.fn(),
  uploadFile: jest.fn(),
};

describe("Certificate issuing (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let helpers: ReturnType<typeof createCertificateHelpers>;
  let certificatesService: CertificatesService;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [{ provide: S3Service, useValue: s3ServiceMock }],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    helpers = createCertificateHelpers({ app, db, runInTenant });
    certificatesService = app.get(CertificatesService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, CERTIFICATE_TABLES);
    await helpers.arrangeGlobalSettings();

    Object.values(s3ServiceMock).forEach((mock) => mock.mockReset());
    s3ServiceMock.getFileExists.mockResolvedValue(true);
    s3ServiceMock.getFileBuffer.mockResolvedValue(Buffer.from(""));
    s3ServiceMock.uploadFile.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, CERTIFICATE_TABLES);
  });

  const issueCertificate = (learnerId: UUIDType, courseId: UUIDType) =>
    runInTenant(() => certificatesService.createCertificate(learnerId, courseId));

  const setCertificateValidity = (
    course: CourseTest,
    certificateValidity: CertificateValidity | null,
  ) =>
    runInTenant(() =>
      db
        .update(courses)
        .set({ settings: { ...course.settings, certificateValidity } })
        .where(eq(courses.id, course.id)),
    );

  const arrangeCompletedCourse = async (courseOverrides: Partial<CourseTest> = {}) => {
    const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
    const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
    const course = await helpers.arrangeCertificateCourse(admin.id, courseOverrides);
    await helpers.arrangeEnrollment(learner.id, course.id, {
      progress: COURSE_PROGRESS_STATUSES.COMPLETED,
      completedAt: COURSE_COMPLETED_AT,
    });

    return { learner, course };
  };

  it.each(CERTIFICATE_EXPIRY_CASES)(
    "issues a certificate dated at completion for a course with $validityLabel",
    async ({ certificateValidity, expectedExpiresAt }) => {
      const { learner, course } = await arrangeCompletedCourse({ title: "Issued Course" });
      await setCertificateValidity(course, certificateValidity);

      const issuedCertificate = await issueCertificate(learner.id, course.id);

      expect(issuedCertificate).toMatchObject({
        userId: learner.id,
        courseId: course.id,
        courseTitle: "Issued Course",
        fullName: `${learner.firstName} ${learner.lastName}`,
      });
      const storedCertificate = await helpers.findCertificate(issuedCertificate.id);
      expect(storedCertificate).toMatchObject({ status: CERTIFICATE_STATUSES.ACTIVE });
      expect(new Date(storedCertificate.issuedAt)).toEqual(new Date(COURSE_COMPLETED_AT));
      expect(storedCertificate.expiresAt && new Date(storedCertificate.expiresAt)).toEqual(
        expectedExpiresAt && new Date(expectedExpiresAt),
      );
    },
  );

  it("returns the learner's active certificate instead of issuing another", async () => {
    const { learner, course } = await arrangeCompletedCourse();
    const firstCertificate = await issueCertificate(learner.id, course.id);

    const secondCertificate = await issueCertificate(learner.id, course.id);

    expect(secondCertificate.id).toBe(firstCertificate.id);
  });

  const arrangeRejectedIssuing = (rejection: IssuingRejection) =>
    match(rejection)
      .with(ISSUING_REJECTIONS.CERTIFICATE_DISABLED, () =>
        arrangeCompletedCourse({ hasCertificate: false }),
      )
      .with(ISSUING_REJECTIONS.COURSE_NOT_COMPLETED, async () => {
        const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
        const course = await helpers.arrangeCertificateCourse(admin.id);
        await helpers.arrangeEnrollment(learner.id, course.id);

        return { learner, course };
      })
      .exhaustive();

  it.each(ISSUING_REJECTION_CASES)(
    "refuses to issue a certificate when $rejection",
    async ({ rejection, expectedMessage }) => {
      const { learner, course } = await arrangeRejectedIssuing(rejection);

      await expect(issueCertificate(learner.id, course.id)).rejects.toThrow(expectedMessage);
    },
  );
});
