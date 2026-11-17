import {
  buildCertificateDocumentTitle,
  buildCertificateHtmlDocument,
  buildCertificateContentDisposition,
  buildCertificateMarkup,
  buildCertificatePdfFilename,
  CERTIFICATE_KIND,
  CERTIFICATE_STYLES,
  defaultCertificateRenderTheme,
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { unescape } from "lodash";

import { LearningPathCertificateService } from "src/learning-path/services/learning-path-certificate.service";

import { CertificatesService } from "../certificates.service";

import type { SupportedLanguages } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";

const classes = [CertificatesService, LearningPathCertificateService];

describe("certificate markup security", () => {
  const payload = `<b><img src=x onerror=alert(1)>&&""''<>`;
  it.each(["studentName", "courseName", "completionDate", "expiryDate"])(
    "encodes all occurrences in %s",
    (field) => {
      const html = buildCertificateMarkup({ [field]: payload });
      expect(html).toContain(
        "&lt;b&gt;&lt;img src=x onerror=alert(1)&gt;&amp;&amp;&quot;&quot;&#39;&#39;&lt;&gt;",
      );
      expect(html).not.toContain("<img src=x");
    },
  );

  it("escapes CSS delimiters and the surrounding HTML attribute", () => {
    const html = buildCertificateMarkup({
      backgroundImageUrl: 'a\\b\\c""())\n\r\f"><iframe src=x>',
    });
    const style = html.match(/style="([^"]*background-image[^"]*)"/)?.[1];
    expect(style).toBeDefined();
    expect(style).toContain("&quot;");
    expect(style).toContain("&lt;iframe");
    expect(style).not.toMatch(/[\n\r\f]/);
    expect(unescape(style)).toContain('a\\\\b\\\\c\\"\\"\\(\\)\\)');
    expect(html).not.toContain("<iframe");
  });

  it("retains normal international names and punctuation", () => {
    const html = buildCertificateMarkup({
      studentName: "Łukasz O'Neill & Zoë",
      courseName: "日本語",
    });
    expect(html).toContain("Łukasz O&#39;Neill &amp; Zoë");
    expect(html).toContain("日本語");
  });

  it("provides static styles for all certificate layout variants", () => {
    for (const expiryDate of ["", "2027-01-01"]) {
      const html = buildCertificateMarkup({
        expiryDate,
        isDownload: true,
        platformLogoUrl: "data:image/png;base64,AA==",
        signatureImageUrl: "data:image/png;base64,AA==",
      });
      const classes = Array.from(html.matchAll(/class="([^"]+)"/g)).flatMap((match) =>
        match[1].split(/\s+/),
      );
      for (const name of new Set(classes)) {
        const selector = name.replace(/([\[\].])/g, "\\$1");
        expect(CERTIFICATE_STYLES).toContain(`.${selector} {`);
      }
    }
  });

  it("omits student email from every certificate layout", () => {
    for (const isDownload of [true, false]) {
      const html = buildCertificateMarkup({
        studentName: "Student",
        isDownload,
        ...{ studentEmail: "student@example.test" },
      });
      expect(html).not.toContain("student@example.test");
    }
  });

  it("rejects CSS declarations supplied as theme colors", () => {
    const html = buildCertificateMarkup({
      colorTheme: {
        ...defaultCertificateRenderTheme,
        titleColor: "red;background:url(https://attacker.test)",
        lineColor: "#abc",
      },
    });
    expect(html).not.toContain("attacker.test");
    expect(html).toContain(`color:${defaultCertificateRenderTheme.titleColor};`);
    expect(html).toContain("border-color:#abc;");
  });

  it.each(Object.values(SUPPORTED_LANGUAGES))(
    "builds a self-contained PDF document in %s",
    (lang) => {
      const document = buildCertificateHtmlDocument(
        buildCertificateMarkup({
          lang,
          certificateKind: CERTIFICATE_KIND.LEARNING_PATH,
          expiryDate: "2027-01-01",
          isDownload: true,
        }),
        { lang, courseName: "Course" },
      );
      expect(document).not.toContain("<script");
      expect(document).not.toContain("<base");
      expect(document).not.toContain("https://");
      expect(document).toContain("Content-Security-Policy");
      expect(document).toContain(".flex { display: flex; }");
      expect(document).toContain("297mm");
    },
  );
});

describe("certificate PDF document metadata", () => {
  it.each(Object.values(SUPPORTED_LANGUAGES))(
    "sets the document language and translated title in %s",
    (lang) => {
      const document = buildCertificateHtmlDocument("<p>Certificate</p>", {
        lang,
        courseName: "Kurs <b>BHP</b>",
      });
      const title = buildCertificateDocumentTitle({ lang, courseName: "Kurs <b>BHP</b>" });

      expect(document).toContain(`<html lang="${lang}">`);
      expect(title).toMatch(/ – Kurs <b>BHP<\/b>$/);
      expect(document).toContain("<title>");
      expect(document).toContain(" – Kurs &lt;b&gt;BHP&lt;/b&gt;</title>");
    },
  );

  it("translates the document title", () => {
    expect(buildCertificateDocumentTitle({ lang: "pl", courseName: "Pierwsza pomoc" })).toBe(
      "Certyfikat ukończenia – Pierwsza pomoc",
    );
    expect(buildCertificateDocumentTitle({ lang: "en", courseName: "First aid" })).toBe(
      "Certificate of completion – First aid",
    );
    expect(buildCertificateDocumentTitle({ lang: "de", courseName: " " })).toBe(
      "Abschlusszertifikat",
    );
  });

  it("names the file with the translated word, course and learner", () => {
    expect(
      buildCertificatePdfFilename({
        lang: "pl",
        courseName: "Pierwsza pomoc",
        studentName: "Łukasz Żółkiewski",
      }),
    ).toBe("Certyfikat - Pierwsza pomoc - Łukasz Żółkiewski.pdf");
  });

  it("removes characters that are illegal in file names", () => {
    expect(
      buildCertificatePdfFilename({
        lang: "en",
        courseName: 'AI/ML: "Basics" <v2>\\?*|',
        studentName: "Jane\u0000 Doe\u007F",
      }),
    ).toBe("Certificate - AI ML Basics v2 - Jane Doe.pdf");
  });

  it("removes bidi control characters", () => {
    expect(
      buildCertificatePdfFilename({
        lang: "en",
        courseName: "\u202Bfdp.exe\u202C \u2066Kurs\u2069",
        studentName: "\u200EJane\u200F \u202ADoe\u202E",
      }),
    ).toBe("Certificate - fdp.exe Kurs - Jane Doe.pdf");
  });

  it("skips empty parts", () => {
    expect(buildCertificatePdfFilename({ lang: "fr", courseName: "", studentName: " " })).toBe(
      "Certificat.pdf",
    );
  });

  it.each([
    ["a long latin course name", "Ż".repeat(300)],
    ["a long CJK course name", "日本語".repeat(100)],
    ["a long emoji course name", "🎓".repeat(100)],
    ["a course name cut at a separator", `${"A".repeat(155)} - . ${"B".repeat(50)}`],
  ])("keeps the learner name and stays within 200 bytes for %s", (_case, courseName) => {
    const filename = buildCertificatePdfFilename({
      lang: "en",
      courseName,
      studentName: "Łukasz Żółkiewski",
    });

    expect(new TextEncoder().encode(filename).length).toBeLessThanOrEqual(200);
    expect(filename).toMatch(/^Certificate - \S.*\S - Łukasz Żółkiewski\.pdf$/u);
    expect(filename).not.toContain("\uFFFD");
  });

  it("drops the course name when the learner name leaves no room for it", () => {
    expect(
      buildCertificatePdfFilename({
        lang: "en",
        courseName: "Course",
        studentName: "Ż".repeat(100),
      }),
    ).toBe(`Certificate - ${"Ż".repeat(91)}.pdf`);
  });
});

describe("certificate Content-Disposition header", () => {
  it.each([
    [
      "Certificate - Python Basics - Jan Kowalski.pdf",
      "Certificate - Python Basics - Jan Kowalski.pdf",
    ],
    [
      "Certyfikat - Python Basics - Łukasz Żółkiewski.pdf",
      "Certyfikat - Python Basics - Lukasz Zolkiewski.pdf",
    ],
    ["Zertifikat - Straße - Søren Ødegård.pdf", "Zertifikat - Strasse - Soren Odegard.pdf"],
    [
      "Certificate - Đorđe Æsir Œuvre æ œ đ ø.pdf",
      "Certificate - Dorde AEsir OEuvre ae oe d o.pdf",
    ],
    ["Certificate - Курс - Иван Петров.pdf", "Certificate.pdf"],
    ["Сертификат - Курс - Иван.pdf", "certificate.pdf"],
    ["Certificate - Kurs 日本 語 - Jan.pdf", "Certificate - Kurs - Jan.pdf"],
    ['Certificate - "Quoted" \\ name.pdf', "Certificate - Quoted name.pdf"],
  ])("uses an ASCII fallback for %s", (filename, asciiFilename) => {
    expect(buildCertificateContentDisposition(filename)).toContain(
      `attachment; filename="${asciiFilename}"; filename*=UTF-8''`,
    );
  });

  it("encodes filename* strictly per RFC 5987", () => {
    expect(
      buildCertificateContentDisposition("Certificate - C (basics)* - Seán O'Brien!.pdf"),
    ).toBe(
      "attachment; filename=\"Certificate - C (basics)* - Sean O'Brien!.pdf\"; filename*=UTF-8''Certificate%20-%20C%20%28basics%29%2A%20-%20Se%C3%A1n%20O%27Brien%21.pdf",
    );
  });
});

describe("certificate download wiring", () => {
  const stubDownloadDependencies = (service: {
    settingsService?: unknown;
    getImageDataUriFromS3Key?: unknown;
    renderPdfFromHtml?: unknown;
  }) => {
    service.settingsService = {
      getImageS3KeysByTenantId: jest.fn().mockResolvedValue({}),
    };
    service.getImageDataUriFromS3Key = jest.fn().mockResolvedValue(null);
    const renderPdfFromHtml = jest.fn().mockResolvedValue(Buffer.from("%PDF"));

    service.renderPdfFromHtml = renderPdfFromHtml;

    return renderPdfFromHtml;
  };

  it("passes the language and path title to the learning path PDF", async () => {
    const service = Object.create(LearningPathCertificateService.prototype);
    const renderPdfFromHtml = stubDownloadDependencies(service);

    service.learningPathRepository = {
      findLearningPathCertificateByIdForRender: jest.fn().mockResolvedValue({
        tenantId: "tenant-a",
        pathTitle: "Ścieżka",
        fullName: "Łukasz Żółkiewski",
      }),
    };

    const result = await service.downloadLearningPathCertificate("user", "cert", "pl");

    const html = renderPdfFromHtml.mock.calls[0][0];

    expect(html).toContain('<html lang="pl">');
    expect(html).toContain("<title>Certyfikat ukończenia – Ścieżka</title>");
    expect(result.filename).toBe("Certyfikat - Ścieżka - Łukasz Żółkiewski.pdf");
  });

  it("passes the language and course title to the course PDF", async () => {
    const service = Object.create(CertificatesService.prototype);
    const renderPdfFromHtml = stubDownloadDependencies(service);

    service.certificateRepository = {
      findCertificateByIdForRender: jest.fn().mockResolvedValue({
        tenantId: "tenant-a",
        courseTitle: "Pierwsza pomoc",
        fullName: "Łukasz Żółkiewski",
      }),
    };
    const currentUser: CurrentUserType = {
      userId: "00000000-0000-0000-0000-000000000001",
      tenantId: "00000000-0000-0000-0000-000000000001",
      email: "student@example.test",
      roleSlugs: ["student"],
      permissions: [PERMISSIONS.CERTIFICATE_RENDER],
    };

    const result = await service.downloadCertificate(currentUser, "cert", "pl");

    const html = renderPdfFromHtml.mock.calls[0][0];

    expect(html).toContain('<html lang="pl">');
    expect(html).toContain("<title>Certyfikat ukończenia – Pierwsza pomoc</title>");
    expect(result.filename).toBe("Certyfikat - Pierwsza pomoc - Łukasz Żółkiewski.pdf");
  });
});

describe.each(classes)("%p rendering", (Service) => {
  // Exercise the real render methods without booting queues, storage or a database.
  const makeService = () => {
    const page = {
      setJavaScriptEnabled: jest.fn().mockResolvedValue(undefined),
      setRequestInterception: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      setViewport: jest.fn().mockResolvedValue(undefined),
      setContent: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      waitForFunction: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from("%PDF")),
      screenshot: jest.fn().mockResolvedValue(Buffer.from("PNG")),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const service = Object.create(Service.prototype);
    service.logger = { error: jest.fn(), warn: jest.fn() };
    service.getBrowser = jest.fn().mockResolvedValue({ newPage: async () => page });
    return { service, page };
  };

  it.each(["renderPdfFromHtml", "renderPngFromHtml"])("secures and closes %s", async (method) => {
    const { service, page } = makeService();
    await service[method]("<p>Certificate</p>");
    expect(page.setJavaScriptEnabled).toHaveBeenCalledWith(false);
    expect(page.setRequestInterception).toHaveBeenCalledWith(true);
    expect(page.on.mock.invocationCallOrder[0]).toBeLessThan(
      page.setContent.mock.invocationCallOrder[0],
    );
    expect(page.setJavaScriptEnabled.mock.invocationCallOrder[0]).toBeLessThan(
      page.setContent.mock.invocationCallOrder[0],
    );
    expect(page.close).toHaveBeenCalledTimes(1);
  });

  it.each(["renderPdfFromHtml", "renderPngFromHtml"])(
    "does not render when policy setup fails in %s",
    async (method) => {
      const { service, page } = makeService();
      page.setRequestInterception.mockRejectedValue(new Error("failed"));
      await expect(service[method]("<p>Certificate</p>")).rejects.toThrow();
      expect(page.setContent).not.toHaveBeenCalled();
      expect(page.close).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["renderPdfFromHtml", "renderPngFromHtml"])(
    "closes the page when assets time out in %s",
    async (method) => {
      const { service, page } = makeService();
      page.waitForFunction.mockRejectedValue(new Error("timeout"));
      await expect(service[method]("<p>Certificate</p>")).rejects.toThrow();
      expect(page.pdf).not.toHaveBeenCalled();
      expect(page.screenshot).not.toHaveBeenCalled();
      expect(page.close).toHaveBeenCalledTimes(1);
    },
  );

  it("embeds share assets using the certificate's tenant settings", async () => {
    const { service } = makeService();
    service.getPublicShareCertificate = jest.fn().mockResolvedValue({
      tenantId: "tenant-a",
      tenantHost: "https://tenant-a.test",
      studentEmail: "private@example.test",
      certificateSignature: "tenant-a/signature.png",
    });
    service.settingsService = {
      getGlobalSettingsByTenantId: jest
        .fn()
        .mockResolvedValue({ platformLogoS3Key: "https://signed.test/logo" }),
      getImageS3KeysByTenantId: jest.fn().mockResolvedValue({
        platformLogoS3Key: "tenant-a/logo.png",
        certificateBackgroundImage: "tenant-a/background.png",
      }),
    };
    service.fileService = {
      getFileContentType: jest.fn().mockResolvedValue("image/png"),
      getRawFileBuffer: jest.fn().mockResolvedValue(Buffer.from("image")),
    };
    service.s3Service = {
      getFileExists: jest.fn().mockResolvedValue(false),
      uploadFile: jest.fn().mockResolvedValue(undefined),
    };
    service.renderPngFromHtml = jest.fn().mockResolvedValue(Buffer.from("new image"));
    // The learning-path share image only draws the signature.
    const embeddedAssets =
      Service === CertificatesService
        ? ["tenant-a/logo.png", "tenant-a/signature.png", "tenant-a/background.png"]
        : ["tenant-a/signature.png"];
    await service.getPublicShareImage("cert", "en");
    expect(service.fileService.getRawFileBuffer.mock.calls).toEqual(
      expect.arrayContaining(embeddedAssets.map((key) => [key])),
    );
    expect(service.fileService.getRawFileBuffer).toHaveBeenCalledTimes(embeddedAssets.length);
    const html = service.renderPngFromHtml.mock.calls[0][0];
    expect(html).toContain("data:image/png;base64,aW1hZ2U=");
    expect(html).not.toContain("https://");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("private@example.test");
  });

  it("serves cached share pages without downloading original assets", async () => {
    const { service } = makeService();
    service.getPublicShareCertificate = jest.fn().mockResolvedValue({
      id: "cert",
      tenantId: "tenant-a",
      tenantHost: "https://tenant-a.test",
      tenantName: "Tenant",
      courseTitle: "Course",
      pathTitle: "Path",
      fullName: "Student",
      certificateSignature: "tenant-a/signature.png",
    });
    service.settingsService = {
      getGlobalSettingsByTenantId: jest.fn().mockResolvedValue({}),
      getImageS3KeysByTenantId: jest.fn(),
    };
    service.fileService = { getFileContentType: jest.fn(), getRawFileBuffer: jest.fn() };
    service.s3Service = {
      getFileExists: jest.fn().mockResolvedValue(true),
      getFileBuffer: jest.fn().mockResolvedValue(Buffer.from("cached image")),
    };
    service.renderPngFromHtml = jest.fn();

    const html = await service.getPublicSharePage("cert", "en");

    expect(html).toContain("data:image/png;base64,Y2FjaGVkIGltYWdl");
    expect(service.settingsService.getImageS3KeysByTenantId).not.toHaveBeenCalled();
    expect(service.fileService.getFileContentType).not.toHaveBeenCalled();
    expect(service.fileService.getRawFileBuffer).not.toHaveBeenCalled();
    expect(service.renderPngFromHtml).not.toHaveBeenCalled();
  });

  it("does not read the pre-hardening image-cache namespace", async () => {
    const { service } = makeService();
    service.getPublicShareCertificate = jest.fn().mockResolvedValue({ tenantId: "tenant-a" });
    service.s3Service = {
      getFileExists: jest.fn().mockResolvedValue(true),
      getFileBuffer: jest.fn().mockResolvedValue(Buffer.from("safe image")),
    };
    await service.getPublicShareImage("cert", "en" as SupportedLanguages);
    const namespace =
      Service === CertificatesService
        ? "certificate-share/v4"
        : "learning-path-certificate-share/v2";
    expect(service.s3Service.getFileBuffer).toHaveBeenCalledWith(
      `tenant-a/${namespace}/cert/en.png`,
    );
  });
});
