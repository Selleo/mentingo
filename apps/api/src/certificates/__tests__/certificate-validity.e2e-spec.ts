import { faker } from "@faker-js/faker";
import {
  CERTIFICATE_ARCHIVE_REASONS,
  CERTIFICATE_STATUSES,
  PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import request from "supertest";
import { match } from "ts-pattern";

import { ACTIVITY_LOG_ACTION_TYPES } from "src/activity-logs/types";
import { EmailAdapter } from "src/common/emails/adapters/email.adapter";
import { DEFAULT_GLOBAL_SETTINGS } from "src/settings/constants/settings.constants";
import { SettingsService } from "src/settings/settings.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { deliverPendingAutomationEmails } from "../../../test/helpers/automation-emails";
import { CERTIFICATE_TABLES, createCertificateHelpers } from "../../../test/helpers/certificates";
import { truncateTables } from "../../../test/helpers/test-helpers";
import {
  CERTIFICATE_ACTIVITY_TRIGGERS,
  SYSTEM_ACTOR_ROLE,
} from "../certificates.activity.constants";
import { CertificatesCron } from "../certificates.cron";
import { CertificatesService } from "../certificates.service";

import {
  ONE_DAY_VALIDITY,
  SYSTEM_ACTOR_EMAIL_CASES,
  VALIDITY_IMPACT_REJECTIONS,
  VALIDITY_IMPACT_REJECTION_CASES,
} from "./certificate-validity.scenarios";

import type { ValidityImpactRejection } from "./certificate-validity.scenarios";
import type { EmailTestingAdapter } from "../../../test/helpers/test-email.adapter";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { UserWithCredentials } from "test/factory/user.factory";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe("Certificate validity (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let defaultTenantId: UUIDType;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let helpers: ReturnType<typeof createCertificateHelpers>;
  let certificatesService: CertificatesService;
  let certificatesCron: CertificatesCron;
  let emailAdapter: EmailTestingAdapter;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      enableActivityLogs: true,
      manualAutomationEmails: true,
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    defaultTenantId = e2e.defaultTenantId;
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    helpers = createCertificateHelpers({ app, db, runInTenant });
    certificatesService = app.get(CertificatesService);
    certificatesCron = app.get(CertificatesCron);
    emailAdapter = app.get<EmailAdapter, EmailTestingAdapter>(EmailAdapter);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, CERTIFICATE_TABLES);
    await helpers.arrangeGlobalSettings();
    emailAdapter.clearEmails();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, CERTIFICATE_TABLES);
  });

  const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_IN_MS).toISOString();

  const asCurrentUser = (admin: UserWithCredentials): CurrentUserType => ({
    userId: admin.id,
    email: admin.email,
    tenantId: admin.tenantId,
    roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
    permissions: [PERMISSIONS.COURSE_ENROLLMENT],
  });

  const findEmailsTo = (recipient: string) =>
    emailAdapter.getAllEmails().filter(({ to }) => to === recipient);

  describe("POST /api/certificates/course/:courseId/validity-impact", () => {
    it("counts active certificates and those a new validity would expire immediately", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await helpers.arrangeCertificateCourse(admin.user.id);
      const otherCourse = await helpers.arrangeCertificateCourse(admin.user.id);
      const [recentLearner, longAgoLearner, archivedLearner, otherCourseLearner] =
        await Promise.all(
          Array.from({ length: 4 }, () => helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT)),
        );
      await helpers.arrangeCertificate({
        userId: recentLearner.id,
        courseId: course.id,
        issuedAt: new Date().toISOString(),
      });
      await helpers.arrangeCertificate({
        userId: longAgoLearner.id,
        courseId: course.id,
        issuedAt: daysFromNow(-10),
      });
      await helpers.arrangeArchivedCertificate(
        { userId: archivedLearner.id, courseId: course.id, issuedAt: daysFromNow(-10) },
        CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
      );
      await helpers.arrangeCertificate({
        userId: otherCourseLearner.id,
        courseId: otherCourse.id,
        issuedAt: daysFromNow(-10),
      });

      const response = await request(app.getHttpServer())
        .post(`/api/certificates/course/${course.id}/validity-impact`)
        .set("Cookie", admin.cookies)
        .send({ certificateValidity: ONE_DAY_VALIDITY })
        .expect(201);

      expect(response.body).toEqual({
        activeCertificateCount: 2,
        immediatelyExpiringCertificateCount: 1,
      });
    });

    const requestImpactRejectedFor = async (rejection: ValidityImpactRejection) => {
      const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await helpers.arrangeCertificateCourse(admin.id);
      const postImpact = (courseId: UUIDType, cookies?: string) => {
        const impactRequest = request(app.getHttpServer())
          .post(`/api/certificates/course/${courseId}/validity-impact`)
          .send({ certificateValidity: ONE_DAY_VALIDITY });

        return cookies ? impactRequest.set("Cookie", cookies) : impactRequest;
      };

      return match(rejection)
        .with(VALIDITY_IMPACT_REJECTIONS.ANONYMOUS_REQUESTER, () => postImpact(course.id))
        .with(VALIDITY_IMPACT_REJECTIONS.STUDENT_REQUESTER, async () => {
          const student = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);

          return postImpact(course.id, student.cookies);
        })
        .with(VALIDITY_IMPACT_REJECTIONS.FOREIGN_AUTHOR, async () => {
          const author = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);

          return postImpact(course.id, author.cookies);
        })
        .with(VALIDITY_IMPACT_REJECTIONS.MISSING_COURSE, async () => {
          const signedInAdmin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);

          return postImpact(faker.string.uuid(), signedInAdmin.cookies);
        })
        .exhaustive();
    };

    it.each(VALIDITY_IMPACT_REJECTION_CASES)(
      "rejects with $expectedStatus when $rejection",
      async ({ rejection, expectedStatus, expectedBody }) => {
        const response = await requestImpactRejectedFor(rejection);

        expect(response.status).toBe(expectedStatus);
        expect(response.body).toMatchObject(expectedBody);
      },
    );
  });

  describe("Applying a validity to existing certificates", () => {
    it("sets new expirations and archives certificates that are already past them", async () => {
      const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await helpers.arrangeCertificateCourse(admin.id);
      const [recentLearner, longAgoLearner, archivedLearner] = await Promise.all(
        Array.from({ length: 3 }, () => helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT)),
      );
      const longAgo = daysFromNow(-10);
      const warningSentAt = new Date().toISOString();
      const recentIssuedAt = new Date().toISOString();
      const recentCertificate = await helpers.arrangeCertificate({
        userId: recentLearner.id,
        courseId: course.id,
        issuedAt: recentIssuedAt,
        expirationWarningSentAt: warningSentAt,
      });
      const longAgoCertificate = await helpers.arrangeCertificate({
        userId: longAgoLearner.id,
        courseId: course.id,
        issuedAt: longAgo,
        expirationWarningSentAt: warningSentAt,
      });
      const archivedCertificate = await helpers.arrangeArchivedCertificate(
        {
          userId: archivedLearner.id,
          courseId: course.id,
          issuedAt: longAgo,
          expiresAt: longAgo,
          archivedAt: longAgo,
          expirationWarningSentAt: warningSentAt,
        },
        CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
      );

      await runInTenant(() =>
        certificatesService.applyValidityToExistingCertificates(
          course.id,
          ONE_DAY_VALIDITY,
          asCurrentUser(admin),
        ),
      );

      const updatedRecentCertificate = await helpers.findCertificate(recentCertificate.id);
      expect(updatedRecentCertificate).toMatchObject({
        status: CERTIFICATE_STATUSES.ACTIVE,
        expirationWarningSentAt: null,
        expiresAt: expect.any(String),
      });
      expect(new Date(updatedRecentCertificate.expiresAt ?? "").getTime()).toBeGreaterThan(
        new Date(recentIssuedAt).getTime(),
      );
      expect(await helpers.findCertificate(longAgoCertificate.id)).toMatchObject({
        status: CERTIFICATE_STATUSES.ARCHIVED,
        archiveReason: CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
        archivedAt: expect.any(String),
        expirationWarningSentAt: null,
      });
      expect(await helpers.findCertificate(archivedCertificate.id)).toEqual(archivedCertificate);
    });

    it("clears expirations without archiving when the validity is removed", async () => {
      const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await helpers.arrangeCertificateCourse(admin.id);
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const archivedLearner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const longAgo = daysFromNow(-10);
      const warningSentAt = new Date().toISOString();
      const activeCertificate = await helpers.arrangeCertificate({
        userId: learner.id,
        courseId: course.id,
        issuedAt: longAgo,
        expiresAt: longAgo,
        expirationWarningSentAt: warningSentAt,
      });
      const archivedCertificate = await helpers.arrangeArchivedCertificate(
        {
          userId: archivedLearner.id,
          courseId: course.id,
          issuedAt: longAgo,
          expiresAt: longAgo,
          archivedAt: longAgo,
          expirationWarningSentAt: warningSentAt,
        },
        CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
      );

      await runInTenant(() =>
        certificatesService.applyValidityToExistingCertificates(
          course.id,
          null,
          asCurrentUser(admin),
        ),
      );

      expect(await helpers.findCertificate(activeCertificate.id)).toMatchObject({
        status: CERTIFICATE_STATUSES.ACTIVE,
        expiresAt: null,
        archivedAt: null,
        archiveReason: null,
        expirationWarningSentAt: null,
      });
      expect(await helpers.findCertificate(archivedCertificate.id)).toEqual(archivedCertificate);
    });
  });

  describe("Daily certificate expiration", () => {
    const arrangeExpiredCertificate = async (courseTitle = "Expiring Certificate Course") => {
      const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await helpers.arrangeCertificateCourse(admin.id, { title: courseTitle });
      const certificate = await helpers.arrangeCertificate({
        userId: learner.id,
        courseId: course.id,
        expiresAt: daysFromNow(-1),
      });

      return { learner, course, certificate };
    };

    it("archives expired certificates", async () => {
      const { certificate } = await arrangeExpiredCertificate();

      await certificatesCron.processCertificatesExpires();

      expect(await helpers.findCertificate(certificate.id)).toMatchObject({
        status: CERTIFICATE_STATUSES.ARCHIVED,
        archiveReason: CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
        archivedAt: expect.any(String),
      });
    });

    it.each(SYSTEM_ACTOR_EMAIL_CASES)(
      "records the expiration as $expectedActorEmail when the company short name is $companyShortNameLabel",
      async ({ companyShortName, expectedActorEmail }) => {
        if (companyShortName) {
          await runInTenant(() =>
            app.get(SettingsService).updateCompanyInformation({
              ...DEFAULT_GLOBAL_SETTINGS.companyInformation,
              companyName: "Acme Learning",
              companyShortName,
            }),
          );
        }
        const { learner, course, certificate } = await arrangeExpiredCertificate();

        await certificatesCron.processCertificatesExpires();

        const [activityLog] = await helpers.waitForActivityLogs(
          ACTIVITY_LOG_ACTION_TYPES.EXPIRE_CERTIFICATE,
        );
        expect(activityLog).toMatchObject({
          actorId: learner.id,
          actorEmail: expectedActorEmail,
          actorRole: SYSTEM_ACTOR_ROLE,
          resourceId: course.id,
          metadata: {
            context: expect.objectContaining({
              certificateId: certificate.id,
              userId: learner.id,
              reason: CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
              trigger: CERTIFICATE_ACTIVITY_TRIGGERS.SYSTEM,
            }),
          },
        });
      },
    );

    it("emails the learner whose certificate expired", async () => {
      const { learner } = await arrangeExpiredCertificate();

      await certificatesCron.processCertificatesExpires();
      await deliverPendingAutomationEmails(app, defaultTenantId);

      expect(findEmailsTo(learner.email)).toHaveLength(1);
    });
  });

  describe("Daily certificate expiration warnings", () => {
    it("warns learners once about certificates expiring within a week", async () => {
      const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await helpers.arrangeCertificateCourse(admin.id);
      const expiringLearner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const laterLearner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const expiringCertificate = await helpers.arrangeCertificate({
        userId: expiringLearner.id,
        courseId: course.id,
        expiresAt: daysFromNow(3),
      });
      const laterCertificate = await helpers.arrangeCertificate({
        userId: laterLearner.id,
        courseId: course.id,
        expiresAt: daysFromNow(30),
      });

      await certificatesCron.processCertificateExpirationWarnings();
      await certificatesCron.processCertificateExpirationWarnings();
      await deliverPendingAutomationEmails(app, defaultTenantId);

      expect(await helpers.findCertificate(expiringCertificate.id)).toMatchObject({
        status: CERTIFICATE_STATUSES.ACTIVE,
        expirationWarningSentAt: expect.any(String),
      });
      expect(await helpers.findCertificate(laterCertificate.id)).toMatchObject({
        expirationWarningSentAt: null,
      });
      expect(findEmailsTo(expiringLearner.email)).toHaveLength(1);
      expect(findEmailsTo(laterLearner.email)).toHaveLength(0);
    });
  });
});
