import {
  CERTIFICATE_ARCHIVE_REASONS,
  CERTIFICATE_RESET_SCOPES,
  CERTIFICATE_STATUSES,
  COURSE_PROGRESS_STATUSES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import request from "supertest";
import { match } from "ts-pattern";

import { ACTIVITY_LOG_ACTION_TYPES } from "src/activity-logs/types";
import { EmailAdapter } from "src/common/emails/adapters/email.adapter";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { deliverPendingAutomationEmails } from "../../../test/helpers/automation-emails";
import { CERTIFICATE_TABLES, createCertificateHelpers } from "../../../test/helpers/certificates";
import { truncateTables } from "../../../test/helpers/test-helpers";
import { CERTIFICATE_ACTIVITY_TRIGGERS } from "../certificates.activity.constants";

import {
  RESET_MANAGEMENT_ENDPOINTS,
  RESET_MANAGEMENT_REJECTION_CASES,
  RESET_MANAGEMENT_REQUESTERS,
  RESET_SCOPE_VALIDATION_CASES,
  RESET_USER_PAGE_CASES,
  RESET_USER_SEARCH_CASES,
} from "./certificate-reset.scenarios";

import type {
  ResetManagementEndpoint,
  ResetManagementRequester,
} from "./certificate-reset.scenarios";
import type { EmailTestingAdapter } from "../../../test/helpers/test-email.adapter";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { SignedInUser } from "test/helpers/course-enrollment";

const COMPLETED_ENROLLMENT = {
  progress: COURSE_PROGRESS_STATUSES.COMPLETED,
  finishedChapterCount: 1,
  completedAt: new Date().toISOString(),
};

const RESET_ENROLLMENT = {
  progress: COURSE_PROGRESS_STATUSES.NOT_STARTED,
  finishedChapterCount: 0,
  completedAt: null,
};

describe("Certificate reset (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let defaultTenantId: UUIDType;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let helpers: ReturnType<typeof createCertificateHelpers>;
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

  const resetCertificates = (admin: SignedInUser, courseId: UUIDType, body: object) =>
    request(app.getHttpServer())
      .post(`/api/certificates/course/${courseId}/reset`)
      .set("Cookie", admin.cookies)
      .send(body);

  const arrangeCompletedLearner = async (courseId: UUIDType) => {
    const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
    await helpers.arrangeEnrollment(learner.id, courseId, COMPLETED_ENROLLMENT);
    const certificate = await helpers.arrangeCertificate({ userId: learner.id, courseId });

    return { learner, certificate };
  };

  const arrangeAdminCourse = async () => {
    const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
    const course = await helpers.arrangeCertificateCourse(admin.user.id);

    return { admin, course };
  };

  describe("POST /api/certificates/course/:courseId/reset", () => {
    it("archives every active certificate, resets the learner's progress and records the reset", async () => {
      const { admin, course } = await arrangeAdminCourse();
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { chapter, lesson } = await helpers.arrangeCompletedQuizProgress(
        learner.id,
        course.id,
        admin.user.id,
      );
      await helpers.arrangeEnrollment(learner.id, course.id, {
        ...COMPLETED_ENROLLMENT,
        finishedChapterCount: 2,
        courseCompletionMetadata: { source: "test" },
      });
      const certificate = await helpers.arrangeCertificate({
        userId: learner.id,
        courseId: course.id,
      });

      const response = await resetCertificates(admin, course.id, {
        scope: CERTIFICATE_RESET_SCOPES.ALL,
        sendEmail: false,
      }).expect(201);

      expect(response.body).toEqual({ affectedCertificateCount: 1, affectedUserCount: 1 });
      expect(await helpers.findCertificate(certificate.id)).toMatchObject({
        status: CERTIFICATE_STATUSES.ARCHIVED,
        archiveReason: CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
        archivedAt: expect.any(String),
      });
      expect(await helpers.findStudentCourse(learner.id, course.id)).toMatchObject({
        ...RESET_ENROLLMENT,
        courseCompletionMetadata: null,
      });
      expect(await helpers.findStudentProgress(learner.id, lesson.id, chapter.id)).toMatchObject({
        lessonProgress: {
          completedQuestionCount: 0,
          quizScore: 0,
          attempts: null,
          isQuizPassed: null,
          isStarted: false,
          completedAt: null,
          languageAnswered: "en",
        },
        chapterProgress: { completedLessonCount: 0, completedAt: null, completedAsFreemium: false },
        attempts: [],
      });

      const [activityLog] = await helpers.waitForActivityLogs(
        ACTIVITY_LOG_ACTION_TYPES.RESET_CERTIFICATE,
      );
      expect(activityLog).toMatchObject({
        actorId: admin.user.id,
        resourceId: course.id,
        metadata: {
          context: expect.objectContaining({
            certificateId: certificate.id,
            userId: learner.id,
            reason: CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
            trigger: CERTIFICATE_ACTIVITY_TRIGGERS.MANUAL,
          }),
        },
      });
    });

    it("resets only the selected learners who hold an active certificate", async () => {
      const { admin, course } = await arrangeAdminCourse();
      const selected = await arrangeCompletedLearner(course.id);
      const untouched = await arrangeCompletedLearner(course.id);
      const selectedWithoutCertificate = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);

      const response = await resetCertificates(admin, course.id, {
        scope: CERTIFICATE_RESET_SCOPES.USERS,
        userIds: [selected.learner.id, selectedWithoutCertificate.id],
        sendEmail: false,
      }).expect(201);

      expect(response.body).toEqual({ affectedCertificateCount: 1, affectedUserCount: 1 });
      expect(await helpers.findCertificate(selected.certificate.id)).toMatchObject({
        status: CERTIFICATE_STATUSES.ARCHIVED,
        archiveReason: CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
      });
      expect(await helpers.findCertificate(untouched.certificate.id)).toMatchObject({
        status: CERTIFICATE_STATUSES.ACTIVE,
        archiveReason: null,
      });
      expect(await helpers.findStudentCourse(selected.learner.id, course.id)).toMatchObject(
        RESET_ENROLLMENT,
      );
      expect(await helpers.findStudentCourse(untouched.learner.id, course.id)).toMatchObject({
        progress: COURSE_PROGRESS_STATUSES.COMPLETED,
        finishedChapterCount: 1,
      });
    });

    it("resets learners of the selected groups once even when they belong to several", async () => {
      const { admin, course } = await arrangeAdminCourse();
      const sharedMember = await arrangeCompletedLearner(course.id);
      const firstGroupMember = await arrangeCompletedLearner(course.id);
      const otherGroupMember = await arrangeCompletedLearner(course.id);
      const firstGroup = await helpers.arrangeGroupWithMembers([
        sharedMember.learner.id,
        firstGroupMember.learner.id,
      ]);
      const secondGroup = await helpers.arrangeGroupWithMembers([sharedMember.learner.id]);
      await helpers.arrangeGroupWithMembers([otherGroupMember.learner.id]);

      const response = await resetCertificates(admin, course.id, {
        scope: CERTIFICATE_RESET_SCOPES.GROUPS,
        groupIds: [firstGroup.id, secondGroup.id],
        sendEmail: false,
      }).expect(201);

      expect(response.body).toEqual({ affectedCertificateCount: 2, affectedUserCount: 2 });
      for (const { learner, certificate } of [sharedMember, firstGroupMember]) {
        expect(await helpers.findCertificate(certificate.id)).toMatchObject({
          status: CERTIFICATE_STATUSES.ARCHIVED,
        });
        expect(await helpers.findStudentCourse(learner.id, course.id)).toMatchObject(
          RESET_ENROLLMENT,
        );
      }
      expect(await helpers.findCertificate(otherGroupMember.certificate.id)).toMatchObject({
        status: CERTIFICATE_STATUSES.ACTIVE,
      });
      expect(await helpers.findStudentCourse(otherGroupMember.learner.id, course.id)).toMatchObject(
        { progress: COURSE_PROGRESS_STATUSES.COMPLETED, finishedChapterCount: 1 },
      );
    });

    it("emails the learners whose certificates were reset", async () => {
      const { admin, course } = await arrangeAdminCourse();
      const { learner } = await arrangeCompletedLearner(course.id);

      await resetCertificates(admin, course.id, { scope: CERTIFICATE_RESET_SCOPES.ALL }).expect(
        201,
      );
      await deliverPendingAutomationEmails(app, defaultTenantId);

      expect(emailAdapter.getAllEmails().filter(({ to }) => to === learner.email)).toHaveLength(1);
    });

    it.each(RESET_SCOPE_VALIDATION_CASES)(
      "rejects the $scope scope without selected ids",
      async ({ scope, expectedMessage }) => {
        const { admin, course } = await arrangeAdminCourse();

        const response = await resetCertificates(admin, course.id, {
          scope,
          sendEmail: false,
        }).expect(400);

        expect(response.body).toMatchObject({ message: expectedMessage });
      },
    );
  });

  describe("GET /api/certificates/course/:courseId/reset-options", () => {
    it("returns groups with active certificates and counts enrolled certificate holders", async () => {
      const { admin, course } = await arrangeAdminCourse();
      const holder = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const formerHolder = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const unenrolledHolder = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const groupWithCertificate = await helpers.arrangeGroupWithMembers([
        holder.id,
        formerHolder.id,
      ]);
      await helpers.arrangeGroupWithMembers([formerHolder.id]);
      await helpers.arrangeEnrollment(holder.id, course.id);
      await helpers.arrangeEnrollment(formerHolder.id, course.id);
      await helpers.arrangeCertificate({ userId: holder.id, courseId: course.id });
      await helpers.arrangeArchivedCertificate(
        { userId: formerHolder.id, courseId: course.id },
        CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
      );
      await helpers.arrangeCertificate({ userId: unenrolledHolder.id, courseId: course.id });

      const response = await request(app.getHttpServer())
        .get(`/api/certificates/course/${course.id}/reset-options`)
        .set("Cookie", admin.cookies)
        .expect(200);

      expect(response.body).toEqual({
        groups: [
          expect.objectContaining({ id: groupWithCertificate.id, activeCertificateCount: 1 }),
        ],
        activeCertificateUserCount: 1,
      });
    });
  });

  describe("GET /api/certificates/course/:courseId/reset-users", () => {
    const arrangeResetUsers = async () => {
      const { admin, course } = await arrangeAdminCourse();
      const learnersByName: Record<string, UUIDType> = {};

      for (const firstName of ["Alpha", "Beta", "Gamma", "Archived", "External"]) {
        const learner = await helpers.arrangeLearner({
          firstName,
          lastName: "Reset",
          email: `${firstName.toLowerCase()}-reset@example.com`,
        });
        learnersByName[firstName] = learner.id;
      }

      for (const firstName of ["Alpha", "Beta", "Gamma", "Archived"]) {
        await helpers.arrangeEnrollment(learnersByName[firstName], course.id);
      }
      for (const firstName of ["Alpha", "Beta", "Gamma", "External"]) {
        await helpers.arrangeCertificate({
          userId: learnersByName[firstName],
          courseId: course.id,
        });
      }
      await helpers.arrangeArchivedCertificate(
        { userId: learnersByName.Archived, courseId: course.id },
        CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
      );

      return { admin, course, learnersByName };
    };

    const getResetUsers = (admin: SignedInUser, courseId: UUIDType, query: object) =>
      request(app.getHttpServer())
        .get(`/api/certificates/course/${courseId}/reset-users`)
        .query(query)
        .set("Cookie", admin.cookies)
        .expect(200);

    it.each(RESET_USER_PAGE_CASES)(
      "returns page $page of enrolled learners with active certificates",
      async ({ page, expectedLearners }) => {
        const { admin, course, learnersByName } = await arrangeResetUsers();

        const response = await getResetUsers(admin, course.id, { page, perPage: 2 });

        expect(response.body.pagination).toMatchObject({ totalItems: 3, page, perPage: 2 });
        expect(response.body.data.map(({ id }: { id: UUIDType }) => id)).toEqual(
          expectedLearners.map((firstName) => learnersByName[firstName]),
        );
      },
    );

    it.each(RESET_USER_SEARCH_CASES)(
      "searches learners by $searchedBy",
      async ({ search, expectedLearners }) => {
        const { admin, course, learnersByName } = await arrangeResetUsers();

        const response = await getResetUsers(admin, course.id, { search });

        expect(response.body).toMatchObject({
          data: expectedLearners.map((firstName) =>
            expect.objectContaining({
              id: learnersByName[firstName],
              email: `${firstName.toLowerCase()}-reset@example.com`,
            }),
          ),
          pagination: { totalItems: expectedLearners.length },
          appliedFilters: { search },
        });
      },
    );
  });

  describe("Certificate reset access", () => {
    const signInRequester = (requester: ResetManagementRequester) =>
      match(requester)
        .with(RESET_MANAGEMENT_REQUESTERS.ANONYMOUS, async () => null)
        .with(RESET_MANAGEMENT_REQUESTERS.STUDENT, () =>
          helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT),
        )
        .with(RESET_MANAGEMENT_REQUESTERS.FOREIGN_AUTHOR, () =>
          helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR),
        )
        .exhaustive();

    const buildEndpointRequest = (endpoint: ResetManagementEndpoint, courseId: UUIDType) =>
      match(endpoint)
        .with(RESET_MANAGEMENT_ENDPOINTS.RESET_OPTIONS, () =>
          request(app.getHttpServer()).get(`/api/certificates/course/${courseId}/reset-options`),
        )
        .with(RESET_MANAGEMENT_ENDPOINTS.RESET_USERS, () =>
          request(app.getHttpServer()).get(`/api/certificates/course/${courseId}/reset-users`),
        )
        .with(RESET_MANAGEMENT_ENDPOINTS.RESET, () =>
          request(app.getHttpServer())
            .post(`/api/certificates/course/${courseId}/reset`)
            .send({ scope: CERTIFICATE_RESET_SCOPES.ALL, sendEmail: false }),
        )
        .exhaustive();

    it.each(RESET_MANAGEMENT_REJECTION_CASES)(
      "rejects $requester calling $endpoint with $expectedStatus",
      async ({ endpoint, requester, expectedStatus, expectedBody }) => {
        const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const course = await helpers.arrangeCertificateCourse(admin.id);
        const signedInRequester = await signInRequester(requester);
        const endpointRequest = buildEndpointRequest(endpoint, course.id);

        const response = await (signedInRequester
          ? endpointRequest.set("Cookie", signedInRequester.cookies)
          : endpointRequest);

        expect(response.status).toBe(expectedStatus);
        expect(response.body).toMatchObject(expectedBody);
      },
    );
  });
});
