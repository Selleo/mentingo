import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
  Inject,
} from "@nestjs/common";
import {
  buildCertificateHtmlDocument as buildSharedCertificateHtmlDocument,
  buildCertificateMarkup,
  CERTIFICATE_ARCHIVE_REASONS,
  CERTIFICATE_RESET_SCOPES,
  CERTIFICATE_VALIDITY_TYPES,
  CERTIFICATE_VALIDITY_UNITS,
  PERMISSIONS,
  SHARE_IMAGE_HEIGHT,
  SHARE_IMAGE_WIDTH,
} from "@repo/shared";
import { addDays, addMonths, addYears, format } from "date-fns";
import { escape } from "lodash";
import puppeteer, { type Page, type Browser } from "puppeteer";
import { match } from "ts-pattern";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "src/activity-logs/types";
import { DatabasePg } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { DEFAULT_PAGE_SIZE, parsePagination } from "src/common/pagination";
import { canUpdateCourseByAuthor } from "src/common/permissions/course-permission.utils";
import { hasPermission } from "src/common/permissions/permission.utils";
import { processInBatches } from "src/common/utils/processInBatches";
import { CertificateArchivedEmailEvent } from "src/events/certificate/certificate-archived-email.event";
import { CertificateExpirationWarningEmailEvent } from "src/events/certificate/certificate-expiration-warning-email.event";
import { FileService } from "src/file/file.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { S3Service } from "src/s3/s3.service";
import { SettingsService } from "src/settings/settings.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { CertificateRepository } from "./certificate.repository";
import {
  CERTIFICATE_ACTIVITY_TRIGGERS,
  SYSTEM_ACTOR_EMAIL_FALLBACK_DOMAIN,
  SYSTEM_ACTOR_ROLE,
} from "./certificates.activity.constants";
import {
  CERTIFICATE_ACTIVITY_LOG_BATCH_SIZE,
  CERTIFICATE_PROGRESS_RESET_BATCH_SIZE,
} from "./certificates.batch.constants";

import type { ShareCertificateRecord, ShareRenderContext } from "./certificates.share.types";
import type {
  CertificatesQuery,
  AllCertificatesResponse,
  CertificateResponse,
  CertificateShareLinkResponse,
  CertificateActivityOperation,
  CertificateActivityReason,
  CertificateActivityRecord,
  CertificateArchiveTarget,
  CertificateExpirationWarningRecord,
  CertificateNotificationRecord,
  CertificateResetUsersQuery,
  CertificateResetUsersResult,
  ResetCourseCertificatesBody,
  ResetCourseCertificatesResponse,
} from "./certificates.types";
import type { OnModuleDestroy } from "@nestjs/common";
import type { CertificateValidity, SupportedLanguages } from "@repo/shared";
import type { PaginatedResponse, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { CertificateEmailRecipient } from "src/events/certificate/certificate-email-recipient";
import type { CertificateExpirationWarningEmailRecipient } from "src/events/certificate/certificate-expiration-warning-email.event";

@Injectable()
export class CertificatesService implements OnModuleDestroy {
  private readonly logger = new Logger(CertificatesService.name);

  private browser: Browser | null = null;
  private browserInitialization: Promise<Browser> | null = null;

  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly certificateRepository: CertificateRepository,
    private readonly settingsService: SettingsService,
    private readonly fileService: FileService,
    private readonly s3Service: S3Service,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly activityLogsService: ActivityLogsService,
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
      return await this.db.transaction(async (trx) => {
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

        const issuedAt = new Date(completionDate);

        const existingCertificate = await this.certificateRepository.findExistingCertificate(
          userId,
          courseId,
          transactionInstance,
        );

        if (existingCertificate) {
          return {
            ...existingCertificate,
            fullName: `${existingUser.firstName} ${existingUser.lastName}`,
            courseTitle: existingCourse.title,
          };
        }

        const expiresAt = this.calculateCertificateExpiry(
          existingCourse.settings.certificateValidity,
          issuedAt,
        );

        const createdCertificate = await this.certificateRepository.create(
          userId,
          courseId,
          issuedAt,
          expiresAt,
          transactionInstance,
        );

        if (!createdCertificate) {
          throw new ConflictException("studentCertificateView.informations.createFailed");
        }

        return {
          ...createdCertificate,
          fullName: `${existingUser.firstName} ${existingUser.lastName}`,
          courseTitle: existingCourse.title,
          completionDate: createdCertificate.issuedAt,
        };
      };

      const result = trx
        ? await executeInTransaction(trx)
        : await this.db.transaction(executeInTransaction);

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

  async getCertificateValidityImpact(
    courseId: UUIDType,
    certificateValidity: CertificateValidity | null,
    currentUser: CurrentUserType,
  ) {
    await this.assertCanManageCourseCertificates(courseId, currentUser);

    return this.certificateRepository.getCertificateValidityImpact(courseId, certificateValidity);
  }

  async applyValidityToExistingCertificates(
    courseId: UUIDType,
    certificateValidity: CertificateValidity | null,
    currentUser: CurrentUserType,
  ) {
    const now = new Date();

    const { immediatelyExpiredCertificates } = await this.db.transaction(async (trx) => {
      await this.certificateRepository.updateActiveCertificateExpirationsForCourse(
        courseId,
        certificateValidity,
        trx,
      );

      const immediatelyExpiredCertificates =
        await this.certificateRepository.findExpiredActiveCertificatesForCourse(courseId, now, trx);

      await this.archiveAndResetCertificates(
        immediatelyExpiredCertificates,
        CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
        trx,
      );

      return { immediatelyExpiredCertificates };
    });

    await this.publishArchivedCertificateEmailEvent(
      immediatelyExpiredCertificates,
      CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
    );

    await this.recordCertificateActivities(
      immediatelyExpiredCertificates,
      ACTIVITY_LOG_ACTION_TYPES.EXPIRE_CERTIFICATE,
      currentUser,
      CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
    );
  }

  async resetCourseCertificates(
    courseId: UUIDType,
    body: ResetCourseCertificatesBody,
    currentUser: CurrentUserType,
  ): Promise<ResetCourseCertificatesResponse> {
    await this.assertCanManageCourseCertificates(courseId, currentUser);

    const certificatesToReset = await this.resolveCertificatesForReset(courseId, body);

    await this.db.transaction(async (trx) => {
      await this.archiveAndResetCertificates(
        certificatesToReset,
        CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
        trx,
      );
    });

    if (body.sendEmail !== false) {
      await this.publishArchivedCertificateEmailEvent(
        certificatesToReset,
        CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
      );
    }

    await this.recordCertificateActivities(
      certificatesToReset,
      ACTIVITY_LOG_ACTION_TYPES.RESET_CERTIFICATE,
      currentUser,
      CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
    );

    return {
      affectedCertificateCount: certificatesToReset.length,
      affectedUserCount: new Set(certificatesToReset.map((certificate) => certificate.userId)).size,
    };
  }

  async getCertificateResetOptions(
    courseId: UUIDType,
    language: SupportedLanguages | undefined,
    currentUser: CurrentUserType,
  ) {
    await this.assertCanManageCourseCertificates(courseId, currentUser);

    const [groups, activeCertificateUserCount] = await Promise.all([
      this.certificateRepository.findCertificateResetGroups(courseId, language),
      this.certificateRepository.countCertificateResetUsers(courseId),
    ]);

    return { groups, activeCertificateUserCount };
  }

  async getCertificateResetUsers(
    courseId: UUIDType,
    query: CertificateResetUsersQuery,
    currentUser: CurrentUserType,
  ): Promise<CertificateResetUsersResult> {
    await this.assertCanManageCourseCertificates(courseId, currentUser);

    const { page, perPage } = parsePagination(query.page, query.perPage, { perPage: 10 });
    const { rows, totalItems } =
      await this.certificateRepository.findPaginatedCertificateResetUsers({
        courseId,
        page,
        perPage,
        language: query.language,
        search: query.search,
      });

    return {
      data: rows,
      pagination: { totalItems, page, perPage },
      appliedFilters: { language: query.language, search: query.search },
    };
  }

  async sendCertificateExpirationWarnings() {
    const now = new Date();
    const warningDate = addDays(now, 7);

    const certificatesToWarn =
      await this.certificateRepository.findCertificatesNeedingExpirationWarning(now, warningDate);

    await this.publishExpirationWarningEmailEvent(certificatesToWarn);

    await this.certificateRepository.markExpirationWarningsSent(
      certificatesToWarn.map((certificate) => certificate.id),
    );
  }

  async expireCertificates() {
    const expiredCertificates = await this.db.transaction(async (trx) => {
      const certificatesToExpire = await this.certificateRepository.findExpiredActiveCertificates(
        new Date(),
        trx,
      );

      await this.archiveAndResetCertificates(
        certificatesToExpire,
        CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
        trx,
      );

      return certificatesToExpire;
    });

    await this.publishArchivedCertificateEmailEvent(
      expiredCertificates,
      CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
    );

    await this.recordCertificateActivities(
      expiredCertificates,
      ACTIVITY_LOG_ACTION_TYPES.EXPIRE_CERTIFICATE,
      undefined,
      CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
    );
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
    const certificate = await this.getPublicShareCertificate(certificateId, shareLanguage);
    const imageKey = this.getShareImageKey(certificate.tenantId, certificateId, shareLanguage);

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
    const certificateDate =
      certificate.issuedAt || certificate.completionDate || certificate.createdAt;

    const html = buildCertificateMarkup({
      studentName: certificate.fullName || "",
      courseName: certificate.courseTitle || "",
      completionDate: this.formatDate(certificateDate || null),
      expiryDate: this.formatDate(certificate.expiresAt || null),
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
      de: {
        openLabel: "Platvorm öffnen",
        pageTitle: `Course completion certificate for "${context.certificate.courseTitle}"`,
        pageDescription: `${context.certificate.fullName} completed "${context.certificate.courseTitle}" and earned a certificate.`,
      },
      lt: {
        openLabel: "Atidaryti platformą",
        pageTitle: `Course completion certificate for "${context.certificate.courseTitle}"`,
        pageDescription: `${context.certificate.fullName} completed "${context.certificate.courseTitle}" and earned a certificate.`,
      },
      cs: {
        openLabel: "Otevřít platformu",
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
      expiryDate: this.formatDate(context.certificate.expiresAt || null),
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

  private getShareImageKey(
    tenantId: UUIDType,
    certificateId: UUIDType,
    language: SupportedLanguages,
  ): string {
    return `${tenantId}/certificate-share/v2/${certificateId}/${language}.png`;
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

  private calculateCertificateExpiry(
    certificateValidity: CertificateValidity | null | undefined,
    issuedAt: Date,
  ): Date | null {
    if (!certificateValidity) return null;

    if (certificateValidity.type === CERTIFICATE_VALIDITY_TYPES.FIXED_DATE) {
      return new Date(`${certificateValidity.date}T23:59:59.999Z`);
    }

    const { unit, value } = certificateValidity;

    return match(unit)
      .with(CERTIFICATE_VALIDITY_UNITS.DAYS, () => addDays(issuedAt, value))
      .with(CERTIFICATE_VALIDITY_UNITS.MONTHS, () => addMonths(issuedAt, value))
      .with(CERTIFICATE_VALIDITY_UNITS.YEARS, () => addYears(issuedAt, value))
      .otherwise(() => null);
  }

  private async assertCanManageCourseCertificates(
    courseId: UUIDType,
    currentUser: CurrentUserType,
  ) {
    const course = await this.certificateRepository.findCourseById(courseId);

    if (!course) throw new NotFoundException("adminCourseView.errors.notFound.course");

    const canManage =
      hasPermission(currentUser.permissions, PERMISSIONS.COURSE_ENROLLMENT) ||
      canUpdateCourseByAuthor(currentUser, course.authorId);

    if (!canManage)
      throw new BadRequestException("adminCourseView.settings.validation.certificateManageDenied");

    return course;
  }

  private async resolveCertificatesForReset(courseId: UUIDType, body: ResetCourseCertificatesBody) {
    const { scope, groupIds, userIds } = body;

    return match(scope)
      .with(CERTIFICATE_RESET_SCOPES.ALL, () =>
        this.certificateRepository.findActiveCertificatesForCourse(courseId),
      )
      .with(CERTIFICATE_RESET_SCOPES.GROUPS, () => {
        if (!groupIds)
          throw new BadRequestException("adminCourseView.settings.validation.groupIdsRequired");

        return this.certificateRepository.findActiveCertificatesForGroups(courseId, groupIds);
      })
      .otherwise(() => {
        if (!userIds)
          throw new BadRequestException("adminCourseView.settings.validation.userIdsRequired");

        return this.certificateRepository.findActiveCertificatesForUsers(courseId, userIds);
      });
  }

  private async archiveAndResetCertificates(
    certificatesToArchive: CertificateArchiveTarget[],
    reason: CertificateActivityReason,
    trx?: DatabasePg,
  ) {
    if (!certificatesToArchive.length) return;

    const certificateIds = certificatesToArchive.map((certificate) => certificate.id);

    const progressResetTargets =
      await this.certificateRepository.findProgressResetTargetsForCertificates(certificateIds, trx);

    await this.certificateRepository.archiveCertificates(certificateIds, reason, trx);

    await processInBatches(
      progressResetTargets,
      ({ courseId, userIds }) =>
        this.certificateRepository.resetCourseProgress(courseId, userIds, trx),
      { batchSize: CERTIFICATE_PROGRESS_RESET_BATCH_SIZE },
    );
  }

  private async publishExpirationWarningEmailEvent(
    certificatesToWarn: CertificateExpirationWarningRecord[],
  ) {
    if (!certificatesToWarn.length) return;

    const certificates = await this.buildCertificateEmailRecipients<
      CertificateExpirationWarningRecord,
      CertificateExpirationWarningEmailRecipient
    >(certificatesToWarn, (certificate, recipient) => {
      if (!certificate.expiresAt) return null;

      return {
        ...recipient,
        expiresAt: format(new Date(certificate.expiresAt), "dd.MM.yyyy"),
      };
    });

    await this.outboxPublisher.publish(
      new CertificateExpirationWarningEmailEvent({ certificates }),
    );
  }

  private async publishArchivedCertificateEmailEvent(
    archivedCertificates: CertificateNotificationRecord[],
    reason: CertificateActivityReason,
  ) {
    if (!archivedCertificates.length) return;

    const certificates = await this.buildCertificateEmailRecipients(archivedCertificates);

    await this.outboxPublisher.publish(new CertificateArchivedEmailEvent({ certificates, reason }));
  }

  private async buildCertificateEmailRecipients<
    TRecord extends CertificateNotificationRecord,
    TRecipient extends CertificateEmailRecipient = CertificateEmailRecipient,
  >(
    certificates: TRecord[],
    mapRecipient?: (
      certificate: TRecord,
      recipient: CertificateEmailRecipient,
    ) => TRecipient | null,
  ): Promise<TRecipient[]> {
    const recipients: TRecipient[] = [];
    const tenantOrigins = new Map<string, Promise<string>>();

    for (const certificate of certificates) {
      const recipient = await this.buildCertificateEmailRecipient(certificate, tenantOrigins);

      const mappedRecipient = mapRecipient
        ? mapRecipient(certificate, recipient)
        : (recipient as TRecipient);

      if (mappedRecipient) recipients.push(mappedRecipient);
    }

    return recipients;
  }

  private async buildCertificateEmailRecipient(
    certificate: CertificateNotificationRecord,
    tenantOrigins: Map<string, Promise<string>>,
  ): Promise<CertificateEmailRecipient> {
    const tenantOrigin = await this.resolveTenantOrigin(certificate.tenantId, tenantOrigins);

    return {
      ...certificate,
      courseName: certificate.courseTitle ?? "",
      courseLink: `${tenantOrigin}/course/${certificate.courseId}`,
    };
  }

  private resolveTenantOrigin(tenantId: string, tenantOrigins: Map<string, Promise<string>>) {
    const existingOrigin = tenantOrigins.get(tenantId);

    if (existingOrigin) return existingOrigin;

    const tenantOrigin = resolveTenantOrigin(this.dbAdmin, tenantId);
    tenantOrigins.set(tenantId, tenantOrigin);
    return tenantOrigin;
  }

  private async recordCertificateActivities(
    affectedCertificates: CertificateActivityRecord[],
    operation: CertificateActivityOperation,
    actor: CurrentUserType | undefined,
    reason: CertificateActivityReason,
  ) {
    const systemActorEmails = new Map<string, Promise<string>>();

    await processInBatches(
      affectedCertificates,
      async (certificate) => {
        const activityActor = await this.resolveCertificateActivityActor(
          certificate,
          actor,
          systemActorEmails,
        );

        await this.activityLogsService.recordActivity({
          actor: activityActor,
          operation,
          resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE,
          resourceId: certificate.courseId,
          tenantId: certificate.tenantId,
          context: {
            certificateId: certificate.id,
            userId: certificate.userId,
            reason,
            trigger: actor
              ? CERTIFICATE_ACTIVITY_TRIGGERS.MANUAL
              : CERTIFICATE_ACTIVITY_TRIGGERS.SYSTEM,
          },
        });
      },
      { batchSize: CERTIFICATE_ACTIVITY_LOG_BATCH_SIZE },
    );
  }

  private async resolveCertificateActivityActor(
    certificate: CertificateActivityRecord,
    actor: CurrentUserType | undefined,
    systemActorEmails: Map<string, Promise<string>>,
  ): Promise<CurrentUserType> {
    if (actor) return actor;

    return {
      userId: certificate.userId,
      email: await this.resolveSystemActorEmail(certificate.tenantId, systemActorEmails),
      roleSlugs: [SYSTEM_ACTOR_ROLE],
      permissions: [],
      tenantId: certificate.tenantId,
    };
  }

  private resolveSystemActorEmail(
    tenantId: UUIDType,
    systemActorEmails: Map<string, Promise<string>>,
  ) {
    const existingEmail = systemActorEmails.get(tenantId);

    if (existingEmail) return existingEmail;

    const systemActorEmail = this.buildSystemActorEmail(tenantId);
    systemActorEmails.set(tenantId, systemActorEmail);
    return systemActorEmail;
  }

  private async buildSystemActorEmail(tenantId: UUIDType): Promise<string> {
    const { companyShortName } =
      await this.settingsService.getCompanyInformationByTenantId(tenantId);

    const domain = this.normalizeCompanyShortNameForSystemActorEmail(companyShortName);

    return `${SYSTEM_ACTOR_ROLE}@${domain}`;
  }

  private normalizeCompanyShortNameForSystemActorEmail(
    companyShortName: string | undefined | null,
  ): string {
    const normalizedDomain = companyShortName
      ?.trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

    return normalizedDomain || SYSTEM_ACTOR_EMAIL_FALLBACK_DOMAIN;
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
