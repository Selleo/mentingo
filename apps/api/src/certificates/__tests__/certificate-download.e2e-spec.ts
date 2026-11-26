import { CERTIFICATE_ARCHIVE_REASONS, SUPPORTED_LANGUAGES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";
import { match } from "ts-pattern";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { CERTIFICATE_TABLES, createCertificateHelpers } from "../../../test/helpers/certificates";
import { mockCertificateCdn } from "../../../test/helpers/mock-certificate-cdn";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  DOWNLOAD_ACCESS_CASES,
  DOWNLOAD_ACCESS_OUTCOMES,
  DOWNLOAD_REQUESTERS,
  PDF_LANGUAGE_CASES,
} from "./certificate-download.scenarios";

import type { DownloadRequester } from "./certificate-download.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { SignedInUser } from "test/helpers/course-enrollment";

// The first PDF render launches the shared headless browser, which can exceed the default timeout on CI.
const PDF_RENDER_TIMEOUT_MS = 90_000;

// Chromium writes non-ASCII titles as UTF-16BE hex strings with a byte order mark,
// and may write plain ASCII titles as literal strings.
const readPdfTitle = (source: string) => {
  const hexTitle = /\/Title\s*<FEFF([0-9A-F]*)>/i.exec(source)?.[1];

  if (typeof hexTitle === "string") {
    if (!/^(?:[0-9A-F]{4})*$/i.test(hexTitle)) {
      throw new Error(`Malformed UTF-16 PDF title: ${hexTitle}`);
    }

    return Buffer.from(hexTitle, "hex").swap16().toString("utf16le");
  }

  const literalTitle = /\/Title\s*\(((?:\\.|[^\\)])*)\)/.exec(source)?.[1];

  return literalTitle?.replace(/\\(.)/g, "$1");
};

// Chromium writes the catalog and info dictionaries uncompressed, so the raw bytes can be searched.
const readPdfDocumentMetadata = (pdf: Buffer) => {
  const source = pdf.toString("latin1");

  return {
    lang: /\/Lang\s*\(([^)]*)\)/.exec(source)?.[1],
    title: readPdfTitle(source),
    displaysDocTitle: /\/DisplayDocTitle\s+true/.test(source),
    isMarked: /\/MarkInfo\s*<<[^>]*\/Marked\s+true/.test(source),
    hasStructTreeRoot: /\/StructTreeRoot\b/.test(source),
  };
};

describe("Certificate download (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let helpers: ReturnType<typeof createCertificateHelpers>;

  beforeAll(async () => {
    mockCertificateCdn();

    const e2e = await createE2ETest({ useDbProxy: true });

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
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, CERTIFICATE_TABLES);
  });

  const downloadCertificate = (
    requester: SignedInUser,
    certificateId: UUIDType,
    language: string = SUPPORTED_LANGUAGES.EN,
  ) =>
    request(app.getHttpServer())
      .post("/api/certificates/download")
      .set("Cookie", requester.cookies)
      .send({ certificateId, language });

  const expectPdf = (response: request.Response) => {
    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.body.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  };

  it("rejects an anonymous request", async () => {
    await request(app.getHttpServer()).post("/api/certificates/download").expect(401);
  });

  it("rejects a request without a certificate", async () => {
    const learner = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);

    await request(app.getHttpServer())
      .post("/api/certificates/download")
      .set("Cookie", learner.cookies)
      .send({ language: SUPPORTED_LANGUAGES.EN })
      .expect(400);
  });

  it.each(PDF_LANGUAGE_CASES)(
    "renders an accessible $language PDF named after the course and learner",
    async ({ language, learnerName, expectedContentDisposition, expectedTitle }) => {
      const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await helpers.arrangeCertificateCourse(admin.id, { title: "Python Basics" });
      const learner = await helpers.arrangeSignedInLearner(learnerName);
      const certificate = await helpers.arrangeCertificate({
        userId: learner.user.id,
        courseId: course.id,
      });

      const response = await downloadCertificate(learner, certificate.id, language).expect(201);

      expectPdf(response);
      expect(response.headers["content-disposition"]).toBe(expectedContentDisposition);
      expect(readPdfDocumentMetadata(response.body)).toEqual({
        lang: language,
        title: expectedTitle,
        displaysDocTitle: true,
        isMarked: true,
        hasStructTreeRoot: true,
      });
    },
    PDF_RENDER_TIMEOUT_MS,
  );

  const arrangeLearnerCertificate = async (authorId: UUIDType) => {
    const course = await helpers.arrangeCertificateCourse(authorId);
    const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
    await helpers.arrangeEnrollment(learner.id, course.id);
    const certificate = await helpers.arrangeCertificate({
      userId: learner.id,
      courseId: course.id,
    });

    return { learner, certificate };
  };

  const arrangeCertificateRequestedBy = async (
    requester: DownloadRequester,
  ): Promise<{ requester: SignedInUser; certificateId: UUIDType }> =>
    match(requester)
      .with(DOWNLOAD_REQUESTERS.COURSE_AUTHOR, async () => {
        const author = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
        const { certificate } = await arrangeLearnerCertificate(author.user.id);

        return { requester: author, certificateId: certificate.id };
      })
      .with(DOWNLOAD_REQUESTERS.ADMIN, async () => {
        const author = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
        const { certificate } = await arrangeLearnerCertificate(author.id);

        return {
          requester: await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN),
          certificateId: certificate.id,
        };
      })
      .with(DOWNLOAD_REQUESTERS.ADMIN_ALSO_GROUP_MANAGER, async () => {
        const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
        await helpers.arrangeGroupManagerRole(admin.user.id, admin.user.tenantId);
        const { certificate } = await arrangeLearnerCertificate(admin.user.id);

        return { requester: admin, certificateId: certificate.id };
      })
      .with(DOWNLOAD_REQUESTERS.GROUP_MANAGER_OWN_CERTIFICATE, async () => {
        const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const manager = await helpers.arrangeSignedInGroupManager();
        const course = await helpers.arrangeCertificateCourse(admin.id);
        const certificate = await helpers.arrangeCertificate({
          userId: manager.user.id,
          courseId: course.id,
        });

        return { requester: manager, certificateId: certificate.id };
      })
      .with(DOWNLOAD_REQUESTERS.GROUP_MANAGER_MANAGED_LEARNER, async () => {
        const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const manager = await helpers.arrangeSignedInGroupManager();
        const { learner, certificate } = await arrangeLearnerCertificate(admin.id);
        await helpers.arrangeManagedGroup(manager.user.id, [learner.id]);

        return { requester: manager, certificateId: certificate.id };
      })
      .with(DOWNLOAD_REQUESTERS.UNRELATED_AUTHOR, async () => {
        const author = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
        const { certificate } = await arrangeLearnerCertificate(author.id);

        return {
          requester: await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR),
          certificateId: certificate.id,
        };
      })
      .with(DOWNLOAD_REQUESTERS.ANOTHER_LEARNER, async () => {
        const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const { certificate } = await arrangeLearnerCertificate(admin.id);

        return {
          requester: await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT),
          certificateId: certificate.id,
        };
      })
      .with(DOWNLOAD_REQUESTERS.ADMIN_ARCHIVED_CERTIFICATE, async () => {
        const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const course = await helpers.arrangeCertificateCourse(admin.user.id);
        const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
        const certificate = await helpers.arrangeArchivedCertificate(
          { userId: learner.id, courseId: course.id },
          CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
        );

        return { requester: admin, certificateId: certificate.id };
      })
      .with(DOWNLOAD_REQUESTERS.ADMIN_DELETED_LEARNER, async () => {
        const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const course = await helpers.arrangeCertificateCourse(admin.user.id);
        const learner = await helpers.arrangeLearner({ deletedAt: new Date().toISOString() });
        const certificate = await helpers.arrangeCertificate({
          userId: learner.id,
          courseId: course.id,
        });

        return { requester: admin, certificateId: certificate.id };
      })
      .with(DOWNLOAD_REQUESTERS.ADMIN_OTHER_TENANT, async () => {
        const certificate = await helpers.arrangeCertificateInOtherTenant();

        return {
          requester: await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN),
          certificateId: certificate.id,
        };
      })
      .with(DOWNLOAD_REQUESTERS.GROUP_MANAGER_UNMANAGED_LEARNER, async () => {
        const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const manager = await helpers.arrangeSignedInGroupManager();
        const { learner, certificate } = await arrangeLearnerCertificate(admin.id);
        await helpers.arrangeGroupWithMembers([learner.id]);

        return { requester: manager, certificateId: certificate.id };
      })
      .exhaustive();

  it.each(DOWNLOAD_ACCESS_CASES)(
    "$outcome for $requester",
    async ({ requester, outcome }) => {
      const arranged = await arrangeCertificateRequestedBy(requester);

      const response = await downloadCertificate(arranged.requester, arranged.certificateId);

      match(outcome)
        .with(DOWNLOAD_ACCESS_OUTCOMES.RENDERED, () => {
          expect(response.status).toBe(201);
          expectPdf(response);
        })
        .with(DOWNLOAD_ACCESS_OUTCOMES.NOT_FOUND, () => {
          expect(response.status).toBe(404);
          expect(response.body).toMatchObject({
            message: "studentCertificateView.informations.certificateNotFound",
          });
        })
        .exhaustive();
    },
    PDF_RENDER_TIMEOUT_MS,
  );
});
