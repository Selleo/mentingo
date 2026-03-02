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
import puppeteer, { type Page, type Browser } from "puppeteer";

import { getSortOptions } from "src/common/helpers/getSortOptions";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { FileService } from "src/file/file.service";
import { S3Service } from "src/s3/s3.service";
import { SettingsService } from "src/settings/settings.service";

import { CertificateRepository } from "./certificate.repository";

import type {
  CertificatesQuery,
  AllCertificatesResponse,
  CertificateResponse,
  CertificateShareLinkResponse,
} from "./certificates.types";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { SupportedLanguages } from "@repo/shared";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PaginatedResponse, UUIDType } from "src/common";
import type { GlobalSettingsJSONContentSchema } from "src/settings/schemas/settings.schema";
import type * as schema from "src/storage/schema";

type ShareCertificateRecord = NonNullable<
  Awaited<ReturnType<CertificateRepository["findPublicShareCertificateById"]>>
>;

type ShareRenderContext = {
  certificate: ShareCertificateRecord;
  shareUrl: string;
  shareImageUrl: string;
  settings: GlobalSettingsJSONContentSchema;
  certificateSignatureUrl: string | null;
  formattedDate: string;
  language: SupportedLanguages;
};

const SHARE_IMAGE_WIDTH = 1200;
const SHARE_IMAGE_HEIGHT = Math.round((SHARE_IMAGE_WIDTH * 210) / 297);

@Injectable()
export class CertificatesService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(CertificatesService.name);

  private browser: Browser | null = null;
  private browserInitialization: Promise<Browser> | null = null;

  constructor(
    private readonly certificateRepository: CertificateRepository,
    private readonly settingsService: SettingsService,
    private readonly fileService: FileService,
    private readonly s3Service: S3Service,
  ) {}

  async onModuleInit() {
    void this.getBrowser().catch((error) => {
      this.logger.warn(`Certificate PDF browser warm-up failed during module init: ${error}`);
    });
  }

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

  async createCertificate(
    userId: UUIDType,
    courseId: UUIDType,
    trx?: PostgresJsDatabase<typeof schema>,
  ) {
    try {
      const executeInTransaction = async (
        transactionInstance: PostgresJsDatabase<typeof schema>,
      ) => {
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
    const publicCertificate = await this.getPublicShareCertificateOrThrow(
      certificateId,
      shareLanguage,
    );
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

  async getPublicSharePage(certificateId: UUIDType, language?: string): Promise<string> {
    const context = await this.buildShareRenderContext(certificateId, language);
    const imageBuffer = await this.getPublicShareImage(certificateId, context.language);
    return this.buildSharePageHtml(context, this.toDataUri(imageBuffer, "image/png"));
  }

  async getPublicShareImage(certificateId: UUIDType, language?: string): Promise<Buffer> {
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

  async downloadCertificate(html: string): Promise<Buffer> {
    if (!html.trim())
      throw new BadRequestException("studentCertificateView.informations.htmlRequired");

    const completeHtml = buildSharedCertificateHtmlDocument(html);

    return this.renderPdfFromHtml(completeHtml);
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
    language?: string,
  ): Promise<ShareRenderContext> {
    const shareLanguage = this.normalizeLanguage(language);
    const certificate = await this.getPublicShareCertificateOrThrow(certificateId, shareLanguage);
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

  private async getPublicShareCertificateOrThrow(
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
      },
      en: {
        openLabel: "Open platform",
      },
    } as const;

    const localizedContent = translations[context.language];

    return {
      pageTitle: this.escapeHtml(this.getShareTitle(context)),
      pageDescription: this.escapeHtml(this.getShareDescription(context)),
      siteName: this.escapeHtml(context.certificate.tenantName),
      courseTitle: this.escapeHtml(context.certificate.courseTitle),
      shareUrl: this.escapeHtml(context.shareUrl),
      shareImageUrl: this.escapeHtml(context.shareImageUrl),
      homeUrl: this.escapeHtml(this.buildTenantUrl(context.certificate.tenantHost, "/", {})),
      openLabel: this.escapeHtml(localizedContent.openLabel),
      faviconUrl: this.escapeHtml(
        context.settings.platformSimpleLogoS3Key ||
          this.buildTenantUrl(
            context.certificate.tenantHost,
            "/app/assets/svgs/app-signet.svg",
            {},
          ),
      ),
      primaryColor: this.escapeHtml(context.settings.primaryColor || "#3f58b6"),
      contrastColor: this.escapeHtml(context.settings.contrastColor || "#ffffff"),
      embeddedImage: this.escapeHtml(embeddedImageSrc),
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
    const base = this.normalizeHost(tenantHost);
    const url = new URL(path, `${base}/`);

    for (const [key, value] of Object.entries(query)) {
      if (!value) continue;
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  private normalizeHost(host: string): string {
    return host.replace(/\/$/, "");
  }

  private getShareImageKey(certificateId: UUIDType, language: SupportedLanguages): string {
    return `certificate-share/${certificateId}/${language}.png`;
  }

  private normalizeLanguage(language?: string): SupportedLanguages {
    return language === "pl" ? "pl" : "en";
  }

  private getShareTitle(context: ShareRenderContext): string {
    const courseTitle = context.certificate.courseTitle || "Certificate";

    return context.language === "pl"
      ? `Certyfikat ukończenia kursu "${courseTitle}"`
      : `Course completion certificate for "${courseTitle}"`;
  }

  private getShareDescription(context: ShareRenderContext): string {
    const fullName = context.certificate.fullName || "";
    const courseTitle = context.certificate.courseTitle || "Certificate";

    return context.language === "pl"
      ? `${fullName} ukończył/a kurs "${courseTitle}" i otrzymał/a certyfikat.`
      : `${fullName} completed "${courseTitle}" and earned a certificate.`;
  }

  private formatDate(input?: string | null): string {
    if (!input) return "";

    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) return input;

    const day = String(parsed.getUTCDate()).padStart(2, "0");
    const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const year = parsed.getUTCFullYear();

    return `${day}.${month}.${year}`;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  private toDataUri(buffer: Buffer, mimeType: string): string {
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
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
    transactionInstance: PostgresJsDatabase<typeof schema>,
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
