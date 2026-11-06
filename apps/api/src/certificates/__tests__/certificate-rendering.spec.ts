import {
  buildCertificateHtmlDocument,
  buildCertificateMarkup,
  CERTIFICATE_KIND,
  CERTIFICATE_STYLES,
  defaultCertificateRenderTheme,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { unescape } from "lodash";

import { LearningPathCertificateService } from "src/learning-path/services/learning-path-certificate.service";

import { CertificatesService } from "../certificates.service";

import type { SupportedLanguages } from "@repo/shared";

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
