import { faker } from "@faker-js/faker";
import { COURSE_ORIGIN_TYPES, COURSE_TYPE, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";
import { match } from "ts-pattern";

import { LESSON_SEQUENCE_ENABLED, QUIZ_FEEDBACK_ENABLED } from "src/courses/constants";
import { UpdateCourseEvent } from "src/events";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { S3Service } from "src/s3/s3.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import {
  COURSE_AUTHORING_TABLES,
  createCourseAuthoringHelpers,
} from "../../../test/helpers/course-authoring";
import { createCourseEnrollmentHelpers } from "../../../test/helpers/course-enrollment";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  CERTIFICATE_VALIDITY_PERIOD,
  COURSE_SETTINGS_ACCESS_CASES,
  COURSE_SETTINGS_ACTORS,
  COURSE_SETTINGS_ENDPOINTS,
  COURSE_SETTINGS_UPDATES,
  EXPORTED_COURSE_SETTINGS_UPDATES,
  SCORM_UNAVAILABLE_SETTINGS,
} from "./course-settings.scenarios";

import type { CourseSettingsActor, CourseSettingsEndpoint } from "./course-settings.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

const s3ServiceMock = {
  getSignedUrl: jest.fn(),
  getFileExists: jest.fn(),
  deleteFile: jest.fn(),
};

const cacheManagerMock = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

describe("Course settings (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let publishSpy: jest.SpyInstance;
  let enrollmentHelpers: ReturnType<typeof createCourseEnrollmentHelpers>;
  let authoringHelpers: ReturnType<typeof createCourseAuthoringHelpers>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        { provide: S3Service, useValue: s3ServiceMock },
        { provide: "CACHE_MANAGER", useValue: cacheManagerMock },
      ],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    publishSpy = jest.spyOn(app.get(OutboxPublisher), "publish");
    enrollmentHelpers = createCourseEnrollmentHelpers({ app, db, runInTenant });
    authoringHelpers = createCourseAuthoringHelpers({ db, runInTenant });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, COURSE_AUTHORING_TABLES);

    publishSpy.mockClear();
    Object.values(s3ServiceMock).forEach((mock) => mock.mockReset());
    Object.values(cacheManagerMock).forEach((mock) => mock.mockReset());
    s3ServiceMock.getSignedUrl.mockImplementation(
      async (key: string) => `https://storage.example.com/${key}`,
    );
    s3ServiceMock.getFileExists.mockResolvedValue(true);
    s3ServiceMock.deleteFile.mockResolvedValue(undefined);
    cacheManagerMock.get.mockResolvedValue(undefined);
    cacheManagerMock.set.mockResolvedValue(undefined);
    cacheManagerMock.del.mockResolvedValue(undefined);

    await enrollmentHelpers.arrangeGlobalSettings();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, COURSE_AUTHORING_TABLES);
  });

  const getSettings = (courseId: UUIDType, cookies: string, expectedStatus = 200) =>
    request(app.getHttpServer())
      .get(`/api/course/settings/${courseId}`)
      .set("Cookie", cookies)
      .expect(expectedStatus);

  const updateSettings = (
    courseId: UUIDType,
    cookies: string,
    body: Record<string, unknown>,
    expectedStatus = 200,
  ) =>
    request(app.getHttpServer())
      .patch(`/api/course/settings/${courseId}`)
      .set("Cookie", cookies)
      .send(body)
      .expect(expectedStatus);

  const arrangeAdminCourse = async (
    overrides: Parameters<typeof authoringHelpers.arrangeCourse>[0] = {},
  ) => {
    const admin = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
    const course = await authoringHelpers.arrangeCourse({ authorId: admin.user.id, ...overrides });

    return { admin, course };
  };

  const publishedCourseUpdates = (courseId: UUIDType) =>
    publishSpy.mock.calls
      .map(([event]) => event)
      .filter(
        (event): event is UpdateCourseEvent =>
          event instanceof UpdateCourseEvent && event.courseUpdateData.courseId === courseId,
      );

  describe("course settings access", () => {
    const accessCases = Object.values(COURSE_SETTINGS_ENDPOINTS).flatMap((endpoint) =>
      COURSE_SETTINGS_ACCESS_CASES.map((accessCase) => ({ endpoint, ...accessCase })),
    );

    const arrangeActorWithCourse = async (actor: CourseSettingsActor) => {
      const author = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const course = await authoringHelpers.arrangeCourse({ authorId: author.user.id });
      const cookies = await match(actor)
        .with(COURSE_SETTINGS_ACTORS.ANONYMOUS, async () => "")
        .with(COURSE_SETTINGS_ACTORS.STUDENT, async () => {
          const student = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);

          return student.cookies;
        })
        .with(COURSE_SETTINGS_ACTORS.AUTHOR, async () => author.cookies)
        .exhaustive();

      return { course, cookies };
    };

    const sendSettingsRequest = (
      endpoint: CourseSettingsEndpoint,
      courseId: UUIDType,
      cookies: string,
      expectedStatus: number,
    ) =>
      match(endpoint)
        .with(COURSE_SETTINGS_ENDPOINTS.GET, () => getSettings(courseId, cookies, expectedStatus))
        .with(COURSE_SETTINGS_ENDPOINTS.PATCH, () =>
          updateSettings(courseId, cookies, { quizFeedbackEnabled: false }, expectedStatus),
        )
        .exhaustive();

    it.each(accessCases)(
      "$endpoint responds $expectedStatus to $actor",
      async ({ endpoint, actor, expectedStatus }) => {
        const { course, cookies } = await arrangeActorWithCourse(actor);

        await sendSettingsRequest(endpoint, course.id, cookies, expectedStatus);
      },
    );

    it.each(Object.values(COURSE_SETTINGS_ENDPOINTS))(
      "%s responds 404 for a course that does not exist",
      async (endpoint) => {
        const admin = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);

        await sendSettingsRequest(endpoint, faker.string.uuid(), admin.cookies, 404);
      },
    );
  });

  describe("GET /api/course/settings/:courseId", () => {
    it("returns the default settings of a new course", async () => {
      const { admin, course } = await arrangeAdminCourse();

      const response = await getSettings(course.id, admin.cookies);

      expect(response.body.data).toMatchObject({
        lessonSequenceEnabled: LESSON_SEQUENCE_ENABLED,
        quizFeedbackEnabled: QUIZ_FEEDBACK_ENABLED,
        videoCompletionTrackingEnabled: true,
        certificateSignature: null,
        certificateSignatureUrl: null,
        certificateValidity: null,
      });
    });

    it("returns the stored settings of a course", async () => {
      const { admin, course } = await arrangeAdminCourse({
        settings: { lessonSequenceEnabled: true, quizFeedbackEnabled: false },
      });

      const response = await getSettings(course.id, admin.cookies);

      expect(response.body.data).toMatchObject({
        lessonSequenceEnabled: true,
        quizFeedbackEnabled: false,
        videoCompletionTrackingEnabled: true,
      });
    });
  });

  describe("PATCH /api/course/settings/:courseId", () => {
    it.each(COURSE_SETTINGS_UPDATES)(
      "$change",
      async ({ initialSettings, body, expectedSettings }) => {
        const { admin, course } = await arrangeAdminCourse({ settings: initialSettings });

        const response = await updateSettings(course.id, admin.cookies, body);
        const settingsResponse = await getSettings(course.id, admin.cookies);

        expect(response.body.data).toEqual({
          message: "Course lesson settings updated successfully",
        });
        expect(settingsResponse.body.data).toMatchObject(expectedSettings);
      },
    );

    it.each(SCORM_UNAVAILABLE_SETTINGS)(
      "rejects $setting for SCORM courses",
      async ({ body, expectedMessage }) => {
        const { admin, course } = await arrangeAdminCourse({ courseType: COURSE_TYPE.SCORM });

        const response = await updateSettings(course.id, admin.cookies, body, 400);

        expect(response.body.message).toBe(expectedMessage);
      },
    );

    it.each(EXPORTED_COURSE_SETTINGS_UPDATES)(
      "responds $expectedStatus when changing the $change of a course exported from a master course",
      async ({ body, expectedStatus }) => {
        const { admin, course } = await arrangeAdminCourse({
          originType: COURSE_ORIGIN_TYPES.EXPORTED,
        });

        await updateSettings(course.id, admin.cookies, body, expectedStatus);
      },
    );

    it("removes the stored certificate signature", async () => {
      const { admin, course } = await arrangeAdminCourse({
        settings: { certificateSignature: "certificate/signature.png" },
      });

      await updateSettings(course.id, admin.cookies, { removeCertificateSignature: true });

      expect(await authoringHelpers.findCourse(course.id)).toMatchObject({
        settings: { certificateSignature: null },
      });
    });

    it("stores a certificate validity and applies it to existing certificates", async () => {
      const { admin, course } = await arrangeAdminCourse();

      await updateSettings(course.id, admin.cookies, {
        certificateValidity: CERTIFICATE_VALIDITY_PERIOD,
        applyValidityToExistingCertificates: true,
      });

      expect(await authoringHelpers.findCourse(course.id)).toMatchObject({
        settings: { certificateValidity: CERTIFICATE_VALIDITY_PERIOD },
      });
    });

    it("clears the certificate validity", async () => {
      const { admin, course } = await arrangeAdminCourse({
        settings: { certificateValidity: CERTIFICATE_VALIDITY_PERIOD },
      });

      await updateSettings(course.id, admin.cookies, { certificateValidity: null });

      expect(await authoringHelpers.findCourse(course.id)).toMatchObject({
        settings: { certificateValidity: null },
      });
    });

    it("does not publish an update when the settings did not change", async () => {
      const { admin, course } = await arrangeAdminCourse();

      await updateSettings(course.id, admin.cookies, {
        certificateFontColor: course.settings.certificateFontColor,
      });

      expect(publishedCourseUpdates(course.id)).toEqual([]);
    });
  });
});
