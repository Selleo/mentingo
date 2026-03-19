import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  buildCertificateHtmlDocument as buildSharedCertificateHtmlDocument,
  buildCertificateMarkup,
} from "@repo/shared";
import { format } from "date-fns";
import { escape } from "lodash";
import puppeteer, { type Page, type Browser } from "puppeteer";

import { getSortOptions } from "src/common/helpers/getSortOptions";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { FileService } from "src/file/file.service";
import { S3Service } from "src/s3/s3.service";
import { SettingsService } from "src/settings/settings.service";

import { CertificateRepository } from "./certificate.repository";
import { SHARE_IMAGE_HEIGHT, SHARE_IMAGE_WIDTH } from "./certificates.constants";

import type { ShareCertificateRecord, ShareRenderContext } from "./certificates.share.types";
import type {
  CertificatesQuery,
  AllCertificatesResponse,
  CertificateResponse,
  CertificateShareLinkResponse,
} from "./certificates.types";
import type { OnModuleDestroy } from "@nestjs/common";
import type { SupportedLanguages } from "@repo/shared";
import type { DatabasePg, PaginatedResponse, UUIDType } from "src/common";

@Injectable()
export class CertificatesService implements OnModuleDestroy {
  private readonly logger = new Logger(CertificatesService.name);

  private browser: Browser | null = null;
  private browserInitialization: Promise<Browser> | null = null;

  constructor(
    private readonly certificateRepository: CertificateRepository,
    private readonly settingsService: SettingsService,
    private readonly fileService: FileService,
    private readonly s3Service: S3Service,
  ) {}

  async onModuleDestroy() {
    const browser =
      this.browser ??
      (this.browserInitialization ? await this.browserInitialization.catch(() => null) : null);

    if (!browser) return;

    await browser.close().catch((error) => {
      this.logger.warn(`Certificate PDF browser close failed during module destroy: ${error}`);
    });

    this.browser = null;
    this.browserInitialization = null;
  }

  async getAllCertificates(
    query: CertificatesQuery,
  ): Promise<PaginatedResponse<AllCertificatesResponse>> {
    const { userId, page = 1, perPage = DEFAULT_PAGE_SIZE, sort = "createdAt", language } = query;
    const { sortOrder } = getSortOptions(sort);

    try {
      return await this.certificateRepository.transaction(async (trx) => {
        const certificates = await this.certificateRepository.findCertificatesByUserId(
          userId,
          page,
          perPage,
          sortOrder,
          language,
          trx,
        );

        const data = await Promise.all(
          certificates.map((certificate) => this.mapCertificateWithSignatureUrl(certificate)),
        );

        const totalItems = await this.certificateRepository.countByUserId(userId, trx);

        return { data, pagination: { totalItems, page, perPage } };
      });
    } catch (error) {
      this.logger.error("Error fetching certificates", error);
      throw new InternalServerErrorException("studentCertificateView.informations.failedToFetch");
    }
  }

  async createCertificate(userId: UUIDType, courseId: UUIDType, trx?: DatabasePg) {
    try {
      const executeInTransaction = async (transactionInstance: DatabasePg) => {
        const { existingUser, existingCourse, completionDate } =
          await this.validateCertificateCreationPreconditions(
            userId,
            courseId,
            transactionInstance,
          );

        const existingCertificate = await this.certificateRepository.findExistingCertificate(
          userId,
          courseId,
          transactionInstance,
        );

        if (existingCertificate) {
          throw new ConflictException("studentCertificateView.informations.alreadyExists");
        }

        const createdCertificate = await this.certificateRepository.create(
          userId,
          courseId,
          transactionInstance,
        );

        if (!createdCertificate) {
          throw new ConflictException("studentCertificateView.informations.createFailed");
        }

        return {
          ...createdCertificate,
          fullName: `${existingUser.firstName} ${existingUser.lastName}`,
          courseTitle: existingCourse.title,
          completionDate: new Date(completionDate).toISOString(),
        };
      };

      const result = trx
        ? await executeInTransaction(trx)
        : await this.certificateRepository.transaction(executeInTransaction);

      this.scheduleCertificateImagePrewarm(result.id);

      return result;
    } catch (error) {
      this.logger.error("Error creating certificate", error);
      throw error;
    }
  }

  async getCertificate(
    userId: UUIDType,
    courseId: UUIDType,
    language: SupportedLanguages,
  ): Promise<CertificateResponse | null> {
    const certificate = await this.certificateRepository.findCertificateByUserAndCourse(
      userId,
      courseId,
      language,
    );

    if (!certificate) return null;

    return this.mapCertificateWithSignatureUrl(certificate);
  }

  async createCertificateShareLink(
    userId: UUIDType,
    certificateId: UUIDType,
    language?: string,
  ): Promise<CertificateShareLinkResponse> {
    const ownedCertificate = await this.certificateRepository.findOwnedCertificateById(
      userId,
      certificateId,
    );

    if (!ownedCertificate?.tenantId) {
      throw new NotFoundException("studentCertificateView.informations.certificateNotFound");
    }

    const shareLanguage = this.normalizeLanguage(language);
    const publicCertificate = await this.getPublicShareCertificate(certificateId, shareLanguage);

    await this.getPublicShareImage(certificateId, shareLanguage);

    const shareUrl = this.buildTenantUrl(publicCertificate.tenantHost, "/api/certificates/share", {
      certificateId,
      lang: shareLanguage,
    });

    const linkedinShareUrl = new URL("https://www.linkedin.com/shareArticle");
    linkedinShareUrl.searchParams.set("mini", "true");
    linkedinShareUrl.searchParams.set("url", shareUrl);

    return {
      shareUrl,
      linkedinShareUrl: linkedinShareUrl.toString(),
    };
  }

  async getPublicSharePage(
    certificateId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<string> {
    const context = await this.buildShareRenderContext(certificateId, language);
    const imageBuffer = await this.getPublicShareImage(certificateId, context.language);
    return this.buildSharePageHtml(context, this.toDataUri(imageBuffer, "image/png"));
  }

  async getPublicShareImage(
    certificateId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<Buffer> {
    const shareLanguage = this.normalizeLanguage(language);
    const imageKey = this.getShareImageKey(certificateId, shareLanguage);

    const exists = await this.s3Service.getFileExists(imageKey).catch((error) => {
      this.logger.warn(`Certificate share image existence check failed: ${error}`);
      return false;
    });

    if (exists) {
      return this.s3Service.getFileBuffer(imageKey);
    }

    const context = await this.buildShareRenderContext(certificateId, shareLanguage);
    const imageBuffer = await this.renderPngFromHtml(this.buildShareImageDocument(context));

    await this.s3Service.uploadFile(imageBuffer, imageKey, "image/png").catch((error) => {
      this.logger.warn(`Certificate share image upload failed: ${error}`);
    });

    return imageBuffer;
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

  async downloadCertificate(
    userId: UUIDType,
    certificateId: UUIDType,
    language?: SupportedLanguages,
    baseUrl?: string | null,
  ): Promise<{ pdfBuffer: Buffer; filename: string }> {
    const shareLanguage = this.normalizeLanguage(language);
    const certificate = await this.certificateRepository.findOwnedCertificateByIdForRender(
      userId,
      certificateId,
      shareLanguage,
    );

    if (!certificate?.tenantId) {
      throw new NotFoundException("studentCertificateView.informations.certificateNotFound");
    }

    const imageSettings = await this.settingsService.getImageS3Keys();
    const [platformLogoImageUrl, certificateSignatureImageUrl, backgroundImageUrl] =
      await Promise.all([
        this.getImageDataUriFromS3Key(imageSettings.platformLogoS3Key),
        this.getImageDataUriFromS3Key(certificate.certificateSignature),
        this.getImageDataUriFromS3Key(imageSettings.certificateBackgroundImage),
      ]);

    const accentColor = certificate.certificateFontColor || imageSettings.primaryColor || "#1f2937";
    const certificateDate = certificate.completionDate || certificate.createdAt;

    const html = buildCertificateMarkup({
      studentName: certificate.fullName || "",
      courseName: certificate.courseTitle || "",
      completionDate: this.formatDate(certificateDate || null),
      platformLogoUrl: platformLogoImageUrl,
      signatureImageUrl: certificateSignatureImageUrl,
      backgroundImageUrl,
      lang: shareLanguage,
      isDownload: true,
      colorTheme: {
        titleColor: accentColor,
        certifyTextColor: accentColor,
        nameColor: accentColor,
        courseNameColor: accentColor,
        bodyTextColor: accentColor,
        labelTextColor: accentColor,
        lineColor: accentColor,
        logoColor: imageSettings.primaryColor || accentColor,
      },
    });

    const completeHtml = buildSharedCertificateHtmlDocument(html, { baseUrl });
    const pdfBuffer = await this.renderPdfFromHtml(completeHtml);

    return {
      pdfBuffer,
      filename: this.buildPdfFilename(certificate.courseTitle),
    };
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
        margin: {
          top: "0",
          bottom: "0",
          left: "0",
          right: "0",
        },
        pageRanges: "1",
        printBackground: true,
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error(`Certificate PDF generation failed: ${error}`);
      throw new InternalServerErrorException(
        "studentCertificateView.informations.pdfGenerationFailed",
      );
    } finally {
      if (page) {
        await page.close().catch((closeError) => {
          this.logger.warn(`Certificate PDF generation page close failed: ${closeError}`);
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
      await page
        .waitForFunction(() => {
          return !("fonts" in document) || document.fonts.status === "loaded";
        })
        .catch(() => {});

      const screenshot = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: SHARE_IMAGE_WIDTH, height: SHARE_IMAGE_HEIGHT },
      });

      return Buffer.from(screenshot);
    } catch (error) {
      this.logger.error(`Certificate share image generation failed: ${error}`);
      throw new InternalServerErrorException(
        "studentCertificateView.informations.shareImageGenerationFailed",
      );
    } finally {
      if (page) {
        await page.close().catch((closeError) => {
          this.logger.warn(`Certificate share image page close failed: ${closeError}`);
        });
      }
    }
  }

  private async buildShareRenderContext(
    certificateId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<ShareRenderContext> {
    const shareLanguage = this.normalizeLanguage(language);
    const certificate = await this.getPublicShareCertificate(certificateId, shareLanguage);
    const settings = await this.settingsService.getGlobalSettingsByTenantId(certificate.tenantId);

    const shareUrl = this.buildTenantUrl(certificate.tenantHost, "/api/certificates/share", {
      certificateId,
      lang: shareLanguage,
    });

    const shareImageUrl = this.buildTenantUrl(
      certificate.tenantHost,
      "/api/certificates/share-image",
      {
        certificateId,
        lang: shareLanguage,
      },
    );

    const certificateSignatureUrl = certificate.certificateSignature
      ? await this.fileService.getFileUrl(certificate.certificateSignature)
      : null;

    return {
      certificate,
      shareUrl,
      shareImageUrl,
      settings,
      certificateSignatureUrl,
      formattedDate: this.formatDate(certificate.completionDate || null),
      language: shareLanguage,
    };
  }

  private async getPublicShareCertificate(
    certificateId: UUIDType,
    language: SupportedLanguages,
  ): Promise<ShareCertificateRecord> {
    const certificate = await this.certificateRepository.findPublicShareCertificateById(
      certificateId,
      language,
    );

    if (!certificate?.tenantId) {
      throw new NotFoundException("studentCertificateView.informations.certificateNotFound");
    }

    return certificate;
  }

  private buildSharePageHtml(context: ShareRenderContext, embeddedImageSrc: string): string {
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
        ${content.faviconUrl ? `<link rel="icon" href="${content.faviconUrl}" />` : ""}
        ${content.faviconUrl ? `<link rel="apple-touch-icon" href="${content.faviconUrl}" />` : ""}
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
          :root {
            color-scheme: light;
            font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
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
          .actions {
            display: flex;
            justify-content: flex-end;
            margin-top: 18px;
          }
          .link {
            display: inline-flex;
            padding: 10px 14px;
            border-radius: 12px;
            text-decoration: none;
            color: ${content.contrastColor};
            background: ${content.primaryColor};
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <main class="card">
          <img src="${content.embeddedImage}" alt="${content.courseTitle}" />
          <div class="actions">
            <a class="link" href="${content.homeUrl}">${content.openLabel}</a>
          </div>
        </main>
      </body>
    </html>`;
  }

  private getSharePageContent(context: ShareRenderContext, embeddedImageSrc: string) {
    const translations = {
      pl: {
        openLabel: "Otwórz platformę",
        pageTitle: `Certyfikat ukończenia kursu "${context.certificate.courseTitle}"`,
        pageDescription: `${context.certificate.fullName} ukończył/a kurs "${context.certificate.courseTitle}" i otrzymał/a certyfikat.`,
      },
      en: {
        openLabel: "Open platform",
        pageTitle: `Course completion certificate for "${context.certificate.courseTitle}"`,
        pageDescription: `${context.certificate.fullName} completed "${context.certificate.courseTitle}" and earned a certificate.`,
      },
    } as const;

    const localizedContent = translations[context.language];

    return {
      pageTitle: escape(localizedContent.pageTitle),
      pageDescription: escape(localizedContent.pageDescription),
      siteName: escape(context.certificate.tenantName),
      courseTitle: escape(context.certificate.courseTitle),
      shareUrl: escape(context.shareUrl),
      shareImageUrl: escape(context.shareImageUrl),
      homeUrl: escape(this.buildTenantUrl(context.certificate.tenantHost, "/", {})),
      openLabel: escape(localizedContent.openLabel),
      faviconUrl: escape(
        context.settings.platformSimpleLogoS3Key ||
          this.buildTenantUrl(
            context.certificate.tenantHost,
            "/app/assets/svgs/app-signet.svg",
            {},
          ),
      ),
      primaryColor: escape(context.settings.primaryColor || "#3f58b6"),
      contrastColor: escape(context.settings.contrastColor || "#ffffff"),
      embeddedImage: escape(embeddedImageSrc),
    };
  }

  private buildShareImageDocument(context: ShareRenderContext): string {
    return this.buildShareImageHtmlDocument(this.buildShareImageMarkup(context));
  }

  private buildShareImageMarkup(context: ShareRenderContext): string {
    const accentColor =
      context.certificate.certificateFontColor || context.settings.primaryColor || "#1f2937";

    return buildCertificateMarkup({
      studentName: context.certificate.fullName || "",
      courseName: context.certificate.courseTitle || "",
      completionDate: context.formattedDate,
      platformLogoUrl: context.settings.platformLogoS3Key,
      signatureImageUrl: context.certificateSignatureUrl,
      backgroundImageUrl: context.settings.certificateBackgroundImage,
      lang: context.language,
      colorTheme: {
        titleColor: accentColor,
        certifyTextColor: accentColor,
        nameColor: accentColor,
        courseNameColor: accentColor,
        bodyTextColor: accentColor,
        labelTextColor: accentColor,
        lineColor: accentColor,
        logoColor: context.settings.primaryColor || accentColor,
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
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
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

  private buildTenantUrl(
    tenantHost: string,
    path: string,
    query: Record<string, string | undefined>,
  ): string {
    const base = tenantHost.replace(/\/$/, "");
    const url = new URL(path, `${base}/`);

    for (const [key, value] of Object.entries(query)) {
      if (!value) continue;
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  private getShareImageKey(certificateId: UUIDType, language: SupportedLanguages): string {
    return `certificate-share/${certificateId}/${language}.png`;
  }

  private normalizeLanguage(language?: string): SupportedLanguages {
    return language === "pl" ? "pl" : "en";
  }

  private buildPdfFilename(courseTitle?: string | null): string {
    const sanitizedTitle = (courseTitle || "")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
      .replace(/\.+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const safeTitle = sanitizedTitle || "certificate";

    return `${safeTitle}.pdf`;
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
    if (!s3Key) {
      return null;
    }

    try {
      const [fileBuffer, contentType] = await Promise.all([
        this.s3Service.getFileBuffer(s3Key),
        this.s3Service.getFileContentType(s3Key).catch(() => null),
      ]);

      if (!fileBuffer.length || !contentType) {
        return null;
      }

      return this.toDataUri(fileBuffer, contentType);
    } catch (error) {
      this.logger.warn(`Failed to get S3 image buffer for key ${s3Key}: ${error}`);
      return null;
    }
  }

  private scheduleCertificateImagePrewarm(certificateId: UUIDType): void {
    setTimeout(() => {
      void Promise.all([
        this.getPublicShareImage(certificateId, "en"),
        this.getPublicShareImage(certificateId, "pl"),
      ]).catch((error) => {
        this.logger.warn(`Certificate image prewarm failed for ${certificateId}: ${error}`);
      });
    }, 1000);
  }

  private async validateCertificateCreationPreconditions(
    userId: UUIDType,
    courseId: UUIDType,
    transactionInstance: DatabasePg,
  ) {
    const existingUser = await this.certificateRepository.findUserById(userId, transactionInstance);
    const existingCourse = await this.certificateRepository.findCourseById(
      courseId,
      transactionInstance,
    );
    const courseCompletion = await this.certificateRepository.findCourseCompletion(
      userId,
      courseId,
      transactionInstance,
    );

    if (!existingUser)
      throw new NotFoundException("studentCertificateView.informations.userNotFound");

    if (!existingCourse)
      throw new NotFoundException("studentCertificateView.informations.courseNotFound");

    if (!existingCourse.certificateEnabled)
      throw new BadRequestException(
        "studentCertificateView.informations.courseCertificateDisabled",
      );

    if (!courseCompletion?.completedAt)
      throw new BadRequestException("studentCertificateView.informations.courseCompletionRequired");

    return {
      existingUser,
      existingCourse,
      completionDate: courseCompletion.completedAt,
    };
  }

  private async mapCertificateWithSignatureUrl<T extends { certificateSignature?: string | null }>(
    certificate: T,
  ): Promise<Omit<T, "certificateSignature"> & { certificateSignatureUrl: string | null }> {
    const { certificateSignature, ...rest } = certificate;

    return {
      ...rest,
      certificateSignatureUrl: certificateSignature
        ? await this.fileService.getFileUrl(certificateSignature)
        : null,
    };
  }
}
