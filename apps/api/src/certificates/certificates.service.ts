import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import puppeteer, { type Page, type Browser } from "puppeteer";

import { getSortOptions } from "src/common/helpers/getSortOptions";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { SettingsService } from "src/settings/settings.service";

import { CertificateRepository } from "./certificate.repository";

import type { CertificatesQuery, AllCertificatesResponse } from "./certificates.types";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { SupportedLanguages } from "@repo/shared";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PaginatedResponse, UUIDType } from "src/common";
import type * as schema from "src/storage/schema";

@Injectable()
export class CertificatesService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(CertificatesService.name);

  private browser: Browser | null = null;

  constructor(
    private readonly certificateRepository: CertificateRepository,
    private readonly settingsService: SettingsService,
  ) {}

  async onModuleInit() {
    try {
      await this.getBrowser();
    } catch (error) {
      this.logger.warn(`Certificate PDF browser warm-up failed during module init: ${error}`);
    }
  }

  async onModuleDestroy() {
    if (!this.browser) return;

    await this.browser.close().catch((error) => {
      this.logger.warn(`Certificate PDF browser close failed during module destroy: ${error}`);
    });

    this.browser = null;
  }

  async getAllCertificates(
    query: CertificatesQuery,
  ): Promise<PaginatedResponse<AllCertificatesResponse>> {
    const { userId, page = 1, perPage = DEFAULT_PAGE_SIZE, sort = "createdAt", language } = query;
    const { sortOrder } = getSortOptions(sort);

    try {
      return await this.certificateRepository.transaction(async (trx) => {
        const data = await this.certificateRepository.findCertificatesByUserId(
          userId,
          page,
          perPage,
          sortOrder,
          language,
          trx,
        );

        const totalItems = await this.certificateRepository.countByUserId(userId, trx);

        return { data, pagination: { totalItems, page, perPage } };
      });
    } catch (error) {
      console.error("Error fetching certificates:", error);
      throw new Error("Failed to fetch certificates");
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
        const existingUser = await this.certificateRepository.findUserById(
          userId,
          transactionInstance,
        );
        const existingCourse = await this.certificateRepository.findCourseById(
          courseId,
          transactionInstance,
        );
        const courseCompletion = await this.certificateRepository.findCourseCompletion(
          userId,
          courseId,
          transactionInstance,
        );

        if (!existingUser) {
          throw new NotFoundException("User not found");
        }

        if (!existingCourse) {
          throw new NotFoundException("Course not found");
        }

        if (!existingCourse.certificateEnabled) {
          throw new BadRequestException("Certificates are disabled for this course");
        }

        if (!courseCompletion?.completedAt) {
          throw new BadRequestException("Course must be completed to generate certificate");
        }

        const existingCertificate = await this.certificateRepository.findExistingCertificate(
          userId,
          courseId,
          transactionInstance,
        );

        if (existingCertificate) {
          throw new ConflictException("Certificate already exists");
        }

        const createdCertificate = await this.certificateRepository.create(
          userId,
          courseId,
          transactionInstance,
        );

        if (!createdCertificate) {
          throw new ConflictException("Unable to create certificate");
        }

        return {
          ...createdCertificate,
          fullName: `${existingUser.firstName} ${existingUser.lastName}`,
          courseTitle: existingCourse.title,
          completionDate: new Date(courseCompletion.completedAt).toISOString(),
        };
      };

      if (trx) {
        return await executeInTransaction(trx);
      } else {
        return await this.certificateRepository.transaction(executeInTransaction);
      }
    } catch (error) {
      console.error("Error creating certificate:", error);
      throw error;
    }
  }

  async getCertificate(userId: UUIDType, courseId: UUIDType, language: SupportedLanguages) {
    try {
      const certificate = await this.certificateRepository.findCertificateByUserAndCourse(
        userId,
        courseId,
        language,
      );

      if (!certificate) {
        throw new NotFoundException("Certificate not found");
      }

      return certificate;
    } catch (error) {
      console.error("Error fetching certificate:", error);
      throw error;
    }
  }

  private async getBrowser() {
    if (this.browser?.connected) return this.browser;

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

    return browser;
  }

  async downloadCertificate(html: string): Promise<Buffer> {
    if (!html.trim()) {
      throw new BadRequestException("HTML content is required");
    }

    const globalSettings = await this.settingsService.getGlobalSettings();

    const backgroundImage = globalSettings?.certificateBackgroundImage;

    const backgroundStyle = backgroundImage
      ? `background: url(${backgroundImage}) no-repeat center center; background-size: 100% 100%;`
      : "background-color: white;";

    const completeHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0; 
          padding: 0;
          box-sizing: border-box;
        }
        body {
          overflow: hidden;
          ${backgroundStyle}
        }
       
        body > * {
          transform: scale(2.2);
        }
        </style>
        <title>Certificate</title>
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `;

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

      throw new Error(`Certificate PDF generation failed: ${error}`);
    } finally {
      if (page) {
        await page.close().catch((closeError) => {
          this.logger.warn(`Certificate PDF generation page close failed: ${closeError}`);
        });
      }
    }
  }
}
