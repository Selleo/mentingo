import { SUPPORTED_LANGUAGES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";
import { match } from "ts-pattern";

import { S3Service } from "src/s3/s3.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { CERTIFICATE_TABLES, createCertificateHelpers } from "../../../test/helpers/certificates";
import { mockCertificateCdn } from "../../../test/helpers/mock-certificate-cdn";
import { DEFAULT_TEST_TENANT_HOST } from "../../../test/helpers/tenant-helpers";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  INVALID_SHARE_TOKEN_CASES,
  PUBLIC_SHARE_PATHS,
  SHARE_PAGE_LANGUAGE_CASES,
  SHARE_TOKEN_KINDS,
} from "./certificate-sharing.scenarios";

import type { ShareTokenKind } from "./certificate-sharing.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { SupportedLanguages } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { SignedInUser } from "test/helpers/course-enrollment";

// The first image render launches the shared headless browser, which can exceed the default timeout on CI.
const IMAGE_RENDER_TIMEOUT_MS = 90_000;

const storedFiles = new Map<string, Buffer>();

const s3ServiceMock = {
  getFileExists: jest.fn(),
  getFileBuffer: jest.fn(),
  uploadFile: jest.fn(),
};

describe("Certificate sharing (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let helpers: ReturnType<typeof createCertificateHelpers>;

  beforeAll(async () => {
    mockCertificateCdn();

    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [{ provide: S3Service, useValue: s3ServiceMock }],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    helpers = createCertificateHelpers({ app, db, runInTenant });
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, CERTIFICATE_TABLES);
    await helpers.arrangeGlobalSettings();

    storedFiles.clear();
    Object.values(s3ServiceMock).forEach((mock) => mock.mockReset());
    s3ServiceMock.getFileExists.mockImplementation(async (key: string) => storedFiles.has(key));
    s3ServiceMock.getFileBuffer.mockImplementation(async (key: string) => storedFiles.get(key));
    s3ServiceMock.uploadFile.mockImplementation(async (file: Buffer, key: string) => {
      storedFiles.set(key, file);
    });
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, CERTIFICATE_TABLES);
  });

  const arrangeLearnerCertificate = async () => {
    const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
    const learner = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);
    const course = await helpers.arrangeCertificateCourse(admin.id, { title: "Shared Course" });
    const certificate = await helpers.arrangeCertificate({
      userId: learner.user.id,
      courseId: course.id,
    });

    return { learner, certificate };
  };

  const createShareLink = (
    learner: SignedInUser,
    certificateId: UUIDType,
    language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
  ) =>
    request(app.getHttpServer())
      .post("/api/certificates/share-link")
      .set("Cookie", learner.cookies)
      .send({ certificateId, language });

  const shareTokenOf = (shareUrl: string) => new URL(shareUrl).searchParams.get("token");

  const arrangeSharedCertificate = async (language: SupportedLanguages) => {
    const { learner, certificate } = await arrangeLearnerCertificate();
    const response = await createShareLink(learner, certificate.id, language).expect(201);

    return { certificate, token: shareTokenOf(response.body.shareUrl) };
  };

  describe("POST /api/certificates/share-link", () => {
    it(
      "creates a public link to the learner's certificate and stores its preview image",
      async () => {
        const { learner, certificate } = await arrangeLearnerCertificate();

        const response = await createShareLink(learner, certificate.id).expect(201);

        const token = shareTokenOf(response.body.shareUrl);
        const shareUrl = `${DEFAULT_TEST_TENANT_HOST}/api/certificates/share?token=${token}&lang=en`;
        expect(token).toEqual(expect.any(String));
        expect(response.body).toEqual({
          shareUrl,
          linkedinShareUrl: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}`,
        });
        expect([...storedFiles.keys()]).toEqual([
          `${learner.user.tenantId}/certificate-share/v5/${certificate.id}/en.png`,
        ]);
      },
      IMAGE_RENDER_TIMEOUT_MS,
    );

    it("keeps the same link when the certificate is shared again", async () => {
      const { learner, certificate } = await arrangeLearnerCertificate();

      const firstResponse = await createShareLink(learner, certificate.id).expect(201);
      const secondResponse = await createShareLink(learner, certificate.id).expect(201);

      expect(secondResponse.body).toEqual(firstResponse.body);
      expect(s3ServiceMock.uploadFile).toHaveBeenCalledTimes(1);
    });

    it("does not share a certificate of another learner", async () => {
      const { certificate } = await arrangeLearnerCertificate();
      const otherLearner = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);

      const response = await createShareLink(otherLearner, certificate.id).expect(404);

      expect(response.body).toMatchObject({
        message: "studentCertificateView.informations.certificateNotFound",
      });
    });
  });

  describe("GET /api/certificates/share", () => {
    it.each(SHARE_PAGE_LANGUAGE_CASES)(
      "serves the $language share page with link-preview metadata",
      async ({ language, expectedTitle }) => {
        const { token } = await arrangeSharedCertificate(language);

        const response = await request(app.getHttpServer())
          .get(PUBLIC_SHARE_PATHS.PAGE)
          .query({ token, lang: language })
          .expect(200);

        expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
        expect(response.text).toContain(expectedTitle);
        expect(response.text).toContain(
          `<meta property="og:image" content="${DEFAULT_TEST_TENANT_HOST}/api/certificates/share-image?token=${token}&amp;lang=${language}" />`,
        );
        expect(response.text).toContain('src="data:image/png;base64,');
      },
    );
  });

  describe("GET /api/certificates/share-image", () => {
    it("serves the stored preview image of a shared certificate", async () => {
      const { certificate, token } = await arrangeSharedCertificate(SUPPORTED_LANGUAGES.EN);
      const storedImage = [...storedFiles.entries()].find(([key]) =>
        key.includes(certificate.id),
      )?.[1];

      const response = await request(app.getHttpServer())
        .get(PUBLIC_SHARE_PATHS.IMAGE)
        .query({ token, lang: SUPPORTED_LANGUAGES.EN })
        .expect(200);

      expect(response.headers["content-type"]).toBe("image/png");
      expect(response.body).toEqual(storedImage);
    });
  });

  describe("Invalid share tokens", () => {
    const shareTokenFor = (tokenKind: ShareTokenKind, certificateId: UUIDType) =>
      match(tokenKind)
        .with(SHARE_TOKEN_KINDS.CERTIFICATE_ID, () => certificateId)
        .with(SHARE_TOKEN_KINDS.MALFORMED, () => "not-a-token")
        .exhaustive();

    it.each(INVALID_SHARE_TOKEN_CASES)(
      "answers $expectedStatus for $tokenKind on $path",
      async ({ path, tokenKind, expectedStatus }) => {
        const { certificate } = await arrangeLearnerCertificate();

        await request(app.getHttpServer())
          .get(path)
          .query({ token: shareTokenFor(tokenKind, certificate.id), lang: SUPPORTED_LANGUAGES.EN })
          .expect(expectedStatus);
      },
    );
  });
});
