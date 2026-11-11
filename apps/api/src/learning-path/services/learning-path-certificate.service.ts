import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  CERTIFICATE_KIND,
  SUPPORTED_LANGUAGES,
  buildCertificateHtmlDocument as buildSharedCertificateHtmlDocument,
  buildCertificateMarkup,
  CERTIFICATE_STYLES,
  CERTIFICATE_CONTENT_SECURITY_POLICY,
  isSupportedLanguage,
} from "@repo/shared";
import { format } from "date-fns";
import puppeteer, { type Browser, type Page } from "puppeteer";

import { buildCertificateSharePageHtml } from "src/certificates/certificate-share-page";
import {
  prepareCertificatePage,
  waitForCertificateAssets,
  getCertificateImageDataUri,
} from "src/common/utils/certificate-renderer";
import { FileService } from "src/file/file.service";
import { IMAGE_QUALITY } from "src/file/image-variants/image-variant.constants";
import { S3Service } from "src/s3/s3.service";
import { SettingsService } from "src/settings/settings.service";

import { LEARNING_PATH_ERRORS } from "../constants/learning-path.errors";
import { LearningPathRepository } from "../learning-path.repository";

import type {
  LearningPathCertificateRenderRecord,
  LearningPathCertificateShareRecord,
} from "./learning-path-certificate.types";
import type { SupportedLanguages } from "@repo/shared";
import type { CertificateSharePageContent } from "src/certificates/certificates.share.types";
import type { UUIDType, DatabasePg } from "src/common";

const SHARE_IMAGE_WIDTH = 1600;
const SHARE_IMAGE_HEIGHT = 900;

@Injectable()
export class LearningPathCertificateService {
  private readonly logger = new Logger(LearningPathCertificateService.name);
  private browser: Browser | null = null;
  private browserInitialization: Promise<Browser> | null = null;

  constructor(
    private readonly learningPathRepository: LearningPathRepository,
    private readonly settingsService: SettingsService,
    private readonly s3Service: S3Service,
    private readonly fileService: FileService,
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
        language,
      )) as LearningPathCertificateRenderRecord,
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
    const publicCertificate = await this.getPublicShareCertificate(certificateId, shareLanguage);
    const token =
      await this.learningPathRepository.issueLearningPathCertificateShareToken(certificateId);
    if (!token)
      throw new NotFoundException("studentCertificateView.informations.certificateNotFound");
    await this.getPublicShareImage(certificateId, shareLanguage);

    const shareUrl = this.buildTenantUrl(
      publicCertificate.tenantHost,
      "/api/learning-path/certificates/share",
      {
        token,
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

  async getPublicSharePageByToken(token: UUIDType, language?: SupportedLanguages) {
    const certificateId = await this.resolveShareToken(token);
    return this.getPublicSharePage(certificateId, language);
  }

  async getPublicShareImageByToken(token: UUIDType, language?: SupportedLanguages) {
    const certificateId = await this.resolveShareToken(token);
    return this.getPublicShareImage(certificateId, language);
  }

  private async resolveShareToken(token: UUIDType): Promise<string> {
    const certificateId =
      await this.learningPathRepository.findLearningPathCertificateIdByShareToken(token);

    if (!certificateId) {
      throw new NotFoundException("studentCertificateView.informations.certificateNotFound");
    }

    return certificateId;
  }

  async getPublicShareImage(certificateId: UUIDType, language?: SupportedLanguages) {
    const shareLanguage = this.normalizeLanguage(language);
    const certificate = await this.getPublicShareCertificate(certificateId, shareLanguage);
    const imageKey = this.getShareImageKey(certificate.tenantId, certificateId, shareLanguage);

    const exists = await this.s3Service.getFileExists(imageKey).catch((error) => {
      this.logger.warn(`Learning path certificate share image existence check failed: ${error}`);
      return false;
    });

    if (exists) {
      return this.s3Service.getFileBuffer(imageKey);
    }

    const context = await this.buildShareRenderContext(certificateId, shareLanguage);
    const html = await this.buildShareImageDocument(context);
    const imageBuffer = await this.renderPngFromHtml(html);

    await this.s3Service.uploadFile(imageBuffer, imageKey, "image/png").catch((error) => {
      this.logger.warn(`Learning path certificate share image upload failed: ${error}`);
    });

    return imageBuffer;
  }

  async downloadLearningPathCertificate(
    userId: UUIDType,
    certificateId: UUIDType,
    language?: SupportedLanguages,
  ) {
    const shareLanguage = this.normalizeLanguage(language);
    const certificate = await this.learningPathRepository.findLearningPathCertificateByIdForRender(
      userId,
      certificateId,
      shareLanguage,
    );

    if (!certificate?.tenantId) {
      throw new NotFoundException("studentCertificateView.informations.certificateNotFound");
    }

    const imageSettings = await this.settingsService.getImageS3KeysByTenantId(certificate.tenantId);
    const [platformLogoImageUrl, backgroundImageUrl, certificateSignatureImageUrl] =
      await Promise.all([
        this.getImageDataUriFromS3Key(imageSettings.platformLogoS3Key),
        this.getImageDataUriFromS3Key(imageSettings.certificateBackgroundImage),
        this.getImageDataUriFromS3Key(certificate.certificateSignature),
      ]);

    const accentColor = certificate.certificateFontColor || imageSettings.primaryColor || "#1f2937";

    const html = buildCertificateMarkup({
      studentName: certificate.fullName || "",
      courseName: certificate.pathTitle ?? "",
      completionDate: this.formatDate(certificate.issuedAt || null),
      platformLogoUrl: platformLogoImageUrl,
      signatureImageUrl: certificateSignatureImageUrl,
      backgroundImageUrl,
      lang: shareLanguage,
      isDownload: true,
      certificateKind: CERTIFICATE_KIND.LEARNING_PATH,
      colorTheme: {
        titleColor: accentColor,
        certifyTextColor: accentColor,
        nameColor: accentColor,
        courseNameColor: accentColor,
        bodyTextColor: accentColor,
        labelTextColor: accentColor,
        lineColor: accentColor,
        logoColor: accentColor,
      },
    });

    const completeHtml = buildSharedCertificateHtmlDocument(html);
    const pdfBuffer = await this.renderPdfFromHtml(completeHtml);

    return {
      pdfBuffer,
      filename: this.buildPdfFilename(certificate.pathTitle),
    };
  }

  private async mapCertificateWithSignatureUrl(certificate: LearningPathCertificateRenderRecord) {
    return {
      id: certificate.id,
      userId: certificate.userId,
      learningPathId: certificate.learningPathId,
      courseTitle: certificate.pathTitle,
      completionDate: this.formatDate(certificate.issuedAt || null),
      fullName: certificate.fullName,
      certificateSignatureUrl: certificate.certificateSignature
        ? await this.fileService.getFileUrl(certificate.certificateSignature, {
            quality: IMAGE_QUALITY.SM,
          })
        : null,
      certificateFontColor: certificate.certificateFontColor,
      createdAt: certificate.createdAt,
    };
  }

  private async buildShareRenderContext(certificateId: UUIDType, language?: SupportedLanguages) {
    const shareLanguage = this.normalizeLanguage(language);
    const certificate = await this.getPublicShareCertificate(certificateId, shareLanguage);
    const settings = await this.settingsService.getGlobalSettingsByTenantId(certificate.tenantId);

    const shareUrl = this.buildTenantUrl(
      certificate.tenantHost,
      "/api/learning-path/certificates/share",
      {
        token: certificate.shareToken ?? undefined,
        lang: shareLanguage,
      },
    );

    const shareImageUrl = this.buildTenantUrl(
      certificate.tenantHost,
      "/api/learning-path/certificates/share-image",
      {
        token: certificate.shareToken ?? undefined,
        lang: shareLanguage,
      },
    );

    return {
      certificate,
      shareUrl,
      shareImageUrl,
      settings,
      formattedDate: this.formatDate(certificate.issuedAt || null),
      language: shareLanguage,
    };
  }

  private async getPublicShareCertificate(
    certificateId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<LearningPathCertificateShareRecord> {
    const certificate = await this.learningPathRepository.findPublicLearningPathCertificateById(
      certificateId,
      language,
    );

    if (!certificate?.tenantId) {
      throw new NotFoundException("studentCertificateView.informations.certificateNotFound");
    }

    return certificate as LearningPathCertificateShareRecord;
  }

  private buildSharePageHtml(context: any, embeddedImageSrc: string): string {
    return buildCertificateSharePageHtml(this.getSharePageContent(context, embeddedImageSrc));
  }

  private getSharePageContent(context: any, embeddedImageSrc: string): CertificateSharePageContent {
    const title = context.certificate.pathTitle ?? "";
    const translations = {
      pl: {
        openLabel: "Otwórz platformę",
        pageTitle: `Certyfikat ukończenia ścieżki rozwoju "${title}"`,
        pageDescription: `${context.certificate.fullName} ukończył/a ścieżkę rozwoju "${title}" i otrzymał/a certyfikat.`,
      },
      en: {
        openLabel: "Open platform",
        pageTitle: `Learning path completion certificate for "${title}"`,
        pageDescription: `${context.certificate.fullName} completed "${title}" and earned a certificate.`,
      },
      de: {
        openLabel: "Plattform öffnen",
        pageTitle: `Zertifikat über den Abschluss des Entwicklungspfads "${title}"`,
        pageDescription: `${context.certificate.fullName} hat "${title}" abgeschlossen und ein Zertifikat erhalten.`,
      },
      lt: {
        openLabel: "Atidaryti platformą",
        pageTitle: `Tobulėjimo kelio baigimo sertifikatas už "${title}"`,
        pageDescription: `${context.certificate.fullName} baigė "${title}" ir gavo sertifikatą.`,
      },
      cs: {
        openLabel: "Otevřít platformu",
        pageTitle: `Certifikát o dokončení rozvojové cesty "${title}"`,
        pageDescription: `${context.certificate.fullName} dokončil/a "${title}" a získal/a certifikát.`,
      },
      es: {
        openLabel: "Abrir plataforma",
        pageTitle: `Certificado de finalización de la ruta de desarrollo "${title}"`,
        pageDescription: `${context.certificate.fullName} completó "${title}" y obtuvo un certificado.`,
      },
      fr: {
        openLabel: "Ouvrir la plateforme",
        pageTitle: `Certificat de réussite du parcours de développement « ${title} »`,
        pageDescription: `${context.certificate.fullName} a terminé le parcours de développement « ${title} » et obtenu un certificat.`,
      },
    } as const satisfies Record<
      SupportedLanguages,
      { openLabel: string; pageTitle: string; pageDescription: string }
    >;

    const localizedContent = translations[context.language as SupportedLanguages];
    const { certificate, settings } = context;

    return {
      language: context.language,
      pageTitle: localizedContent.pageTitle,
      pageDescription: localizedContent.pageDescription,
      shareUrl: context.shareUrl,
      shareImageUrl: context.shareImageUrl,
      imageWidth: SHARE_IMAGE_WIDTH,
      imageHeight: SHARE_IMAGE_HEIGHT,
      homeUrl: this.buildTenantUrl(certificate.tenantHost, "/", {}),
      openLabel: localizedContent.openLabel,
      logoUrl: settings.platformLogoS3Key ?? null,
      faviconUrl:
        settings.platformSimpleLogoS3Key ||
        this.buildTenantUrl(certificate.tenantHost, "/app/assets/svgs/app-signet.svg", {}),
      primaryColor: settings.primaryColor,
      contrastColor: settings.contrastColor,
      embeddedImage: embeddedImageSrc,
    };
  }

  private async buildShareImageDocument(context: any): Promise<string> {
    const certificateSignatureUrl = await this.getImageDataUriFromS3Key(
      context.certificate.certificateSignature,
    );

    return this.buildShareImageHtmlDocument(
      this.buildShareImageMarkup({ ...context, certificateSignatureUrl }),
    );
  }

  private buildShareImageMarkup(context: any) {
    const accentColor =
      context.certificate.certificateFontColor || context.settings.primaryColor || "#1f2937";

    return buildCertificateMarkup({
      studentName: context.certificate.fullName || "",
      courseName: context.certificate.pathTitle ?? "",
      completionDate: context.formattedDate,
      platformLogoUrl: null,
      signatureImageUrl: context.certificateSignatureUrl,
      backgroundImageUrl: null,
      lang: context.language,
      certificateKind: CERTIFICATE_KIND.LEARNING_PATH,
      colorTheme: {
        titleColor: accentColor,
        certifyTextColor: accentColor,
        nameColor: accentColor,
        courseNameColor: accentColor,
        bodyTextColor: accentColor,
        labelTextColor: accentColor,
        lineColor: accentColor,
        logoColor: accentColor,
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
        <style>${CERTIFICATE_STYLES}</style>
        ${CERTIFICATE_CONTENT_SECURITY_POLICY}
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

      await prepareCertificatePage(page);
      await page.setContent(completeHtml, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForSelector("body > *", { timeout: 5_000 });
      await waitForCertificateAssets(page);

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
      await prepareCertificatePage(page);
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForSelector("body > *", { timeout: 5_000 });
      await waitForCertificateAssets(page);

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
    return language && isSupportedLanguage(language) ? language : SUPPORTED_LANGUAGES.EN;
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
    return getCertificateImageDataUri(this.fileService, s3Key);
  }

  private getShareImageKey(
    tenantId: UUIDType,
    certificateId: UUIDType,
    language: SupportedLanguages,
  ) {
    return `${tenantId}/learning-path-certificate-share/v2/${certificateId}/${language}.png`;
  }
}
