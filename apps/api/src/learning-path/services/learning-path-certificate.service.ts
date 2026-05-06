import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  buildCertificateHtmlDocument as buildSharedCertificateHtmlDocument,
  buildCertificateMarkup,
} from "@repo/shared";
import { format } from "date-fns";
import { escape } from "lodash";
import puppeteer, { type Browser, type Page } from "puppeteer";

import { S3Service } from "src/s3/s3.service";
import { SettingsService } from "src/settings/settings.service";

import { LEARNING_PATH_ERRORS } from "../constants/learning-path.errors";
import { LearningPathRepository } from "../learning-path.repository";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType, DatabasePg } from "src/common";

const SHARE_IMAGE_WIDTH = 1600;
const SHARE_IMAGE_HEIGHT = 900;

type LearningPathCertificateShareRecord = NonNullable<
  Awaited<ReturnType<LearningPathRepository["findPublicLearningPathCertificateById"]>>
>;

type LearningPathCertificateRenderRecord = NonNullable<
  Awaited<ReturnType<LearningPathRepository["findLearningPathCertificateByIdForRender"]>>
>;

@Injectable()
export class LearningPathCertificateService {
  private readonly logger = new Logger(LearningPathCertificateService.name);
  private browser: Browser | null = null;
  private browserInitialization: Promise<Browser> | null = null;

  constructor(
    private readonly learningPathRepository: LearningPathRepository,
    private readonly settingsService: SettingsService,
    private readonly s3Service: S3Service,
  ) {}

  async onModuleDestroy() {
    const browser =
      this.browser ??
      (this.browserInitialization ? await this.browserInitialization.catch(() => null) : null);

    if (!browser) return;

    await browser.close().catch((error) => {
      this.logger.warn(
        `Learning path certificate browser close failed during module destroy: ${error}`,
      );
    });

    this.browser = null;
    this.browserInitialization = null;
  }

  async createLearningPathCertificate(
    userId: UUIDType,
    learningPathId: UUIDType,
    trx?: DatabasePg,
  ) {
    const existingCertificate =
      await this.learningPathRepository.findLearningPathCertificateByUserAndPath(
        userId,
        learningPathId,
        trx,
      );

    if (existingCertificate) {
      return existingCertificate;
    }

    const learningPath = await this.learningPathRepository.findLearningPathById(
      learningPathId,
      trx,
    );
    if (!learningPath?.tenantId) {
      throw new NotFoundException(LEARNING_PATH_ERRORS.NOT_FOUND);
    }

    if (!learningPath.includesCertificate) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.CERTIFICATE_DISABLED);
    }

    const created = await this.learningPathRepository.createLearningPathCertificate(
      userId,
      learningPathId,
      learningPath.tenantId,
      trx,
    );

    if (!created) {
      const existingCertificate =
        await this.learningPathRepository.findLearningPathCertificateByUserAndPath(
          userId,
          learningPathId,
          trx,
        );

      if (existingCertificate) return existingCertificate;

      throw new InternalServerErrorException("studentCertificateView.informations.createFailed");
    }

    return created;
  }

  async getLearningPathCertificate(
    userId: UUIDType,
    learningPathId: UUIDType,
    language: SupportedLanguages,
  ) {
    const certificate = await this.learningPathRepository.findLearningPathCertificateByUserAndPath(
      userId,
      learningPathId,
    );

    if (!certificate) return null;

    return this.mapCertificateWithSignatureUrl(
      (await this.learningPathRepository.findLearningPathCertificateByIdForRender(
        userId,
        certificate.id,
      )) as LearningPathCertificateRenderRecord,
      language,
    );
  }

  async createLearningPathCertificateShareLink(
    userId: UUIDType,
    certificateId: UUIDType,
    language?: string,
  ) {
    const ownedCertificate = await this.learningPathRepository.findLearningPathCertificateById(
      userId,
      certificateId,
    );

    if (!ownedCertificate?.tenantId) {
      throw new NotFoundException("studentCertificateView.informations.certificateNotFound");
    }

    const shareLanguage = this.normalizeLanguage(language);
    const publicCertificate = await this.getPublicShareCertificate(certificateId);
    await this.getPublicShareImage(certificateId, shareLanguage);

    const shareUrl = this.buildTenantUrl(
      publicCertificate.tenantHost,
      "/api/learning-path/certificates/share",
      {
        certificateId,
        lang: shareLanguage,
      },
    );

    const linkedinShareUrl = new URL("https://www.linkedin.com/shareArticle");
    linkedinShareUrl.searchParams.set("mini", "true");
    linkedinShareUrl.searchParams.set("url", shareUrl);

    return { shareUrl, linkedinShareUrl: linkedinShareUrl.toString() };
  }

  async getPublicSharePage(certificateId: UUIDType, language?: SupportedLanguages) {
    const context = await this.buildShareRenderContext(certificateId, language);
    const imageBuffer = await this.getPublicShareImage(certificateId, context.language);
    return this.buildSharePageHtml(context, this.toDataUri(imageBuffer, "image/png"));
  }

  async getPublicShareImage(certificateId: UUIDType, language?: SupportedLanguages) {
    const shareLanguage = this.normalizeLanguage(language);
    const certificate = await this.getPublicShareCertificate(certificateId);
    const imageKey = this.getShareImageKey(certificate.tenantId, certificateId, shareLanguage);

    const exists = await this.s3Service.getFileExists(imageKey).catch((error) => {
      this.logger.warn(`Learning path certificate share image existence check failed: ${error}`);
      return false;
    });

    if (exists) {
      return this.s3Service.getFileBuffer(imageKey);
    }

    const context = await this.buildShareRenderContext(certificateId, shareLanguage);
    const imageBuffer = await this.renderPngFromHtml(this.buildShareImageDocument(context));

    await this.s3Service.uploadFile(imageBuffer, imageKey, "image/png").catch((error) => {
      this.logger.warn(`Learning path certificate share image upload failed: ${error}`);
    });

    return imageBuffer;
  }

  async downloadLearningPathCertificate(
    userId: UUIDType,
    certificateId: UUIDType,
    language?: SupportedLanguages,
    baseUrl?: string | null,
  ) {
    const shareLanguage = this.normalizeLanguage(language);
    const certificate = await this.learningPathRepository.findLearningPathCertificateByIdForRender(
      userId,
      certificateId,
    );

    if (!certificate?.tenantId) {
      throw new NotFoundException("studentCertificateView.informations.certificateNotFound");
    }

    const imageSettings = await this.settingsService.getImageS3Keys();
    const [platformLogoImageUrl, backgroundImageUrl] = await Promise.all([
      this.getImageDataUriFromS3Key(imageSettings.platformLogoS3Key),
      this.getImageDataUriFromS3Key(imageSettings.certificateBackgroundImage),
    ]);

    const html = buildCertificateMarkup({
      studentName: certificate.fullName || "",
      courseName: certificate.pathTitle
        ? this.getLocalizedText(certificate.pathTitle, shareLanguage)
        : "",
      completionDate: this.formatDate(certificate.issuedAt || null),
      platformLogoUrl: platformLogoImageUrl,
      backgroundImageUrl,
      lang: shareLanguage,
      isDownload: true,
      colorTheme: {
        titleColor: imageSettings.primaryColor || "#1f2937",
        certifyTextColor: imageSettings.primaryColor || "#1f2937",
        nameColor: imageSettings.primaryColor || "#1f2937",
        courseNameColor: imageSettings.primaryColor || "#1f2937",
        bodyTextColor: imageSettings.primaryColor || "#1f2937",
        labelTextColor: imageSettings.primaryColor || "#1f2937",
        lineColor: imageSettings.primaryColor || "#1f2937",
        logoColor: imageSettings.primaryColor || "#1f2937",
      },
    });

    const completeHtml = buildSharedCertificateHtmlDocument(html, { baseUrl });
    const pdfBuffer = await this.renderPdfFromHtml(completeHtml);

    return {
      pdfBuffer,
      filename: this.buildPdfFilename(
        certificate.pathTitle ? this.getLocalizedText(certificate.pathTitle, shareLanguage) : null,
      ),
    };
  }

  private async mapCertificateWithSignatureUrl(
    certificate: LearningPathCertificateRenderRecord,
    language: SupportedLanguages,
  ) {
    return {
      id: certificate.id,
      userId: certificate.userId,
      learningPathId: certificate.learningPathId,
      courseTitle: this.getLocalizedText(certificate.pathTitle, language),
      completionDate: this.formatDate(certificate.issuedAt || null),
      fullName: certificate.fullName,
      certificateSignatureUrl: null,
      certificateFontColor: null,
      createdAt: certificate.createdAt,
    };
  }

  private async buildShareRenderContext(certificateId: UUIDType, language?: SupportedLanguages) {
    const shareLanguage = this.normalizeLanguage(language);
    const certificate = await this.getPublicShareCertificate(certificateId);
    const settings = await this.settingsService.getGlobalSettingsByTenantId(certificate.tenantId);

    const shareUrl = this.buildTenantUrl(
      certificate.tenantHost,
      "/api/learning-path/certificates/share",
      {
        certificateId,
        lang: shareLanguage,
      },
    );

    const shareImageUrl = this.buildTenantUrl(
      certificate.tenantHost,
      "/api/learning-path/certificates/share-image",
      {
        certificateId,
        lang: shareLanguage,
      },
    );

    return {
      certificate,
      shareUrl,
      shareImageUrl,
      settings,
      certificateSignatureUrl: null,
      formattedDate: this.formatDate(certificate.issuedAt || null),
      language: shareLanguage,
    };
  }

  private async getPublicShareCertificate(
    certificateId: UUIDType,
  ): Promise<LearningPathCertificateShareRecord> {
    const certificate =
      await this.learningPathRepository.findPublicLearningPathCertificateById(certificateId);

    if (!certificate?.tenantId) {
      throw new NotFoundException("studentCertificateView.informations.certificateNotFound");
    }

    return certificate as LearningPathCertificateShareRecord;
  }

  private buildSharePageHtml(context: any, embeddedImageSrc: string): string {
    const content = this.getSharePageContent(context, embeddedImageSrc);

    return `<!DOCTYPE html>
    <html lang="${context.language}">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${content.pageTitle}</title>
        <meta name="description" content="${content.pageDescription}" />
        <meta name="robots" content="noindex,noarchive" />
        <link rel="canonical" href="${content.shareUrl}" />
        <meta property="og:title" content="${content.pageTitle}" />
        <meta property="og:description" content="${content.pageDescription}" />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="${content.shareUrl}" />
        <meta property="og:image" content="${content.shareImageUrl}" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="${SHARE_IMAGE_WIDTH}" />
        <meta property="og:image:height" content="${SHARE_IMAGE_HEIGHT}" />
        <meta property="og:site_name" content="${content.siteName}" />
        <meta name="twitter:card" content="summary_large_image" />
        <style>
          :root { color-scheme: light; font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background:
              radial-gradient(circle at top right, rgba(63, 88, 182, 0.14), transparent 35%),
              linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
            color: #0f172a;
          }
          .card {
            width: min(100%, 860px);
            background: rgba(255,255,255,0.92);
            border: 1px solid rgba(148, 163, 184, 0.28);
            border-radius: 24px;
            padding: 24px;
            box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
          }
          img {
            width: 100%;
            display: block;
            border-radius: 18px;
            border: 1px solid rgba(148, 163, 184, 0.28);
            background: #fff;
          }
        </style>
      </head>
      <body>
        <main class="card">
          <img src="${content.embeddedImage}" alt="${content.courseTitle}" />
        </main>
      </body>
    </html>`;
  }

  private getSharePageContent(context: any, embeddedImageSrc: string) {
    const title = this.getLocalizedText(context.certificate.pathTitle, context.language);
    const pageTitle = `Learning path completion certificate for "${title}"`;
    const pageDescription = `${context.certificate.fullName} completed "${title}" and earned a certificate.`;

    return {
      pageTitle: escape(pageTitle),
      pageDescription: escape(pageDescription),
      siteName: escape(context.certificate.tenantName),
      courseTitle: escape(title),
      shareUrl: escape(context.shareUrl),
      shareImageUrl: escape(context.shareImageUrl),
      embeddedImage: escape(embeddedImageSrc),
      primaryColor: escape(context.settings.primaryColor || "#3f58b6"),
    };
  }

  private buildShareImageDocument(context: any) {
    return this.buildShareImageHtmlDocument(this.buildShareImageMarkup(context));
  }

  private buildShareImageMarkup(context: any) {
    return buildCertificateMarkup({
      studentName: context.certificate.fullName || "",
      courseName: this.getLocalizedText(context.certificate.pathTitle, context.language),
      completionDate: context.formattedDate,
      platformLogoUrl: null,
      backgroundImageUrl: null,
      lang: context.language,
      colorTheme: {
        titleColor: context.settings.primaryColor || "#1f2937",
        certifyTextColor: context.settings.primaryColor || "#1f2937",
        nameColor: context.settings.primaryColor || "#1f2937",
        courseNameColor: context.settings.primaryColor || "#1f2937",
        bodyTextColor: context.settings.primaryColor || "#1f2937",
        labelTextColor: context.settings.primaryColor || "#1f2937",
        lineColor: context.settings.primaryColor || "#1f2937",
        logoColor: context.settings.primaryColor || "#1f2937",
      },
    });
  }

  private buildShareImageHtmlDocument(html: string): string {
    return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: ${SHARE_IMAGE_WIDTH}px;
            height: ${SHARE_IMAGE_HEIGHT}px;
            overflow: hidden;
            background: transparent;
          }
          body > * {
            width: ${SHARE_IMAGE_WIDTH}px;
            height: ${SHARE_IMAGE_HEIGHT}px;
          }
        </style>
        <title>Certificate</title>
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      </head>
      <body>
        ${html}
      </body>
    </html>`;
  }

  private async renderPdfFromHtml(completeHtml: string): Promise<Buffer> {
    let page: Page | null = null;

    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();

      await page.setContent(completeHtml, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForSelector("body > *", { timeout: 5_000 });
      await page
        .waitForFunction(() => {
          return !("fonts" in document) || document.fonts.status === "loaded";
        })
        .catch(() => {});

      const pdfBuffer = await page.pdf({
        format: "A4",
        landscape: true,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
        pageRanges: "1",
        printBackground: true,
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error(`Learning path certificate PDF generation failed: ${error}`);
      throw new InternalServerErrorException(
        "studentCertificateView.informations.pdfGenerationFailed",
      );
    } finally {
      if (page) {
        await page.close().catch((closeError) => {
          this.logger.warn(`Learning path certificate PDF page close failed: ${closeError}`);
        });
      }
    }
  }

  private async renderPngFromHtml(html: string): Promise<Buffer> {
    let page: Page | null = null;

    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();

      await page.setViewport({
        width: SHARE_IMAGE_WIDTH,
        height: SHARE_IMAGE_HEIGHT,
        deviceScaleFactor: 1,
      });
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForSelector("body > *", { timeout: 5_000 });

      const screenshot = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: SHARE_IMAGE_WIDTH, height: SHARE_IMAGE_HEIGHT },
      });

      return Buffer.from(screenshot);
    } catch (error) {
      this.logger.error(`Learning path certificate share image generation failed: ${error}`);
      throw new InternalServerErrorException(
        "studentCertificateView.informations.shareImageGenerationFailed",
      );
    } finally {
      if (page) {
        await page.close().catch((closeError) => {
          this.logger.warn(
            `Learning path certificate share image page close failed: ${closeError}`,
          );
        });
      }
    }
  }

  private async getBrowser() {
    if (this.browser?.connected) return this.browser;
    if (this.browserInitialization) return this.browserInitialization;

    this.browserInitialization = (async () => {
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });

      this.browser = browser;

      browser.on("disconnected", () => {
        if (this.browser === browser) this.browser = null;
      });

      return browser;
    })().finally(() => {
      this.browserInitialization = null;
    });

    return this.browserInitialization;
  }

  private buildTenantUrl(
    tenantHost: string,
    path: string,
    query: Record<string, string | undefined>,
  ) {
    const base = tenantHost.replace(/\/$/, "");
    const url = new URL(path, `${base}/`);

    for (const [key, value] of Object.entries(query)) {
      if (!value) continue;
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  private normalizeLanguage(language?: string): SupportedLanguages {
    return language === "pl" ? "pl" : "en";
  }

  private buildPdfFilename(courseTitle?: string | null) {
    const sanitizedTitle = (courseTitle || "")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
      .replace(/\.+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return `${sanitizedTitle || "certificate"}.pdf`;
  }

  private formatDate(inputDate?: string | null): string {
    if (!inputDate) return "";

    const parsedDate = new Date(inputDate);
    if (Number.isNaN(parsedDate.getTime())) return inputDate;

    return format(parsedDate, "dd.MM.yyyy");
  }

  private toDataUri(buffer: Buffer, mimeType: string): string {
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }

  private async getImageDataUriFromS3Key(s3Key?: string | null): Promise<string | null> {
    if (!s3Key) return null;

    try {
      const [fileBuffer] = await Promise.all([this.s3Service.getFileBuffer(s3Key)]);
      return this.toDataUri(fileBuffer, "image/png");
    } catch {
      return null;
    }
  }

  private getShareImageKey(
    tenantId: UUIDType,
    certificateId: UUIDType,
    language: SupportedLanguages,
  ) {
    return `${tenantId}/learning-path-certificate-share/${certificateId}/${language}.png`;
  }

  private getLocalizedText(
    text: Record<string, string> | null | undefined,
    language: SupportedLanguages,
  ) {
    return text?.[language] ?? text?.en ?? "";
  }
}
