import { randomUUID } from "crypto";
import path from "path";

import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import AdmZip from "adm-zip";
import { JSDOM } from "jsdom";
import { match } from "ts-pattern";
import xml2js from "xml2js";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { AdminChapterService } from "src/chapter/adminChapter.service";
import { DatabasePg } from "src/common";
import { FileService } from "src/file/file.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { S3Service } from "src/s3/s3.service";

import { SCORM } from "../constants/scorm.consts";
import { ScormRepository } from "../repositories/scorm.repository";

import type { UUIDType } from "src/common";
import type { LessonTypes } from "src/lesson/lesson.type";
import type { UserRole } from "src/user/schemas/userRoles";

type ScormChapter = {
  title: string;
  identifier: string;
  displayOrder: number;
  lessons: ScormLesson[];
};

type ScormLesson = {
  title: string;
  identifier: string;
  href: string;
  type: LessonTypes;
  displayOrder: number;
  isQuiz: boolean;
};

@Injectable()
export class ScormService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly s3Service: S3Service,
    private readonly bunnyStreamService: BunnyStreamService,
    private readonly fileService: FileService,
    private readonly scormRepository: ScormRepository,
    private readonly adminChapterService: AdminChapterService,
    private readonly adminLessonService: AdminLessonService,
  ) {}

  /**
   * Processes uploaded SCORM package. Each SCORM package is a ZIP containing:
   * - imsmanifest.xml (defines structure and metadata)
   * - HTML/JS/CSS files (actual content)
   * - Additional resources (images, etc.)
   *
   * Process:
   * 1. Extracts and validates imsmanifest.xml
   * 2. Uploads all files to S3 maintaining folder structure
   * 3. Creates DB records linking SCORM to course
   *
   * Example manifest structure:
   * <manifest>
   *   <metadata>
   *     <schemaversion>1.2</schemaversion>
   *   </metadata>
   *   <resources>
   *     <resource identifier="R1" type="webcontent" adlcp:scormtype="sco" href="index.html"/>
   *   </resources>
   * </manifest>
   *
   * @param file - SCORM ZIP file uploaded by user
   * @param courseId - Course to which this SCORM belongs
   * @param userId - User who uploaded the package
   * @returns Created metadata record with files location and entry point
   * @throws BadRequestException if package is invalid
   */
  async processScormPackage(
    file: Express.Multer.File,
    courseId: UUIDType,
    userId: UUIDType,
    currentUserRole: UserRole,
  ) {
    return await this.db.transaction(async (tx) => {
      try {
        const { manifest, version, entries } = await this.parseAndValidateScorm(file);

        const chapters = this.parseScormStructure(manifest);

        const s3BaseKey = `scorm/${courseId}/${randomUUID()}`;
        await Promise.all(
          entries
            .filter((entry) => !entry.isDirectory)
            .map((entry) =>
              this.s3Service.uploadFile(
                entry.getData(),
                `${s3BaseKey}/${entry.entryName}`,
                this.getContentType(entry.name),
              ),
            ),
        );

        const createdFile = await this.scormRepository.createScormFile(
          {
            title: file.originalname,
            type: "scorm-package",
            s3KeyPath: s3BaseKey,
          },
          tx,
        );

        const metadata = await this.scormRepository.createScormMetadata(
          {
            courseId,
            fileId: createdFile.id,
            version,
            entryPoint: this.findEntryPoint(manifest),
            s3Key: s3BaseKey,
          },
          tx,
        );

        for (const chapter of chapters) {
          const createdChapter = await this.adminChapterService.createChapterForCourse(
            {
              title: chapter.title,
              courseId,
              isFreemium: false,
            },
            userId,
            currentUserRole,
          );

          // Create lessons
          for (const lesson of chapter.lessons) {
            await this.adminLessonService.createLessonForChapter(
              {
                title: lesson.title,
                chapterId: createdChapter.id,
                type: lesson.type,
                description: "",
                fileS3Key: lesson.href ? `${s3BaseKey}/${lesson.href}` : undefined,
                fileType: this.getContentType(lesson.href),
              },
              userId,
              currentUserRole,
            );
          }
        }

        return metadata;
      } catch (error) {
        try {
          await this.s3Service.deleteFile(`courses/${courseId}`);
        } catch (cleanupError) {
          console.error("Failed to cleanup S3 files:", cleanupError);
        }
        throw error;
      }
    });
  }

  /**
   * Serves content from uploaded SCORM package.
   * All SCORM content must be served from the same origin as the LMS for APIs to work.
   * We achieve this by:
   * 1. Finding the S3 location using metadata
   * 2. Generating signed URL for requested file
   * 3. Redirecting browser to signed URL
   *
   * Note: Original file paths from manifest must be preserved for SCORM to work.
   * Example: if manifest has href="content/index.html", that exact path must be used.
   *
   * @param courseId - Course containing the SCORM
   * @param filePath - Original path of file inside SCORM package
   * @returns Signed S3 URL for the file
   */
  async serveContent(
    courseId: UUIDType,
    filePath: string,
    baseUrl: string,
  ): Promise<string | Buffer> {
    const metadata = await this.scormRepository.getScormMetadata(courseId);
    if (!metadata) {
      throw new NotFoundException("SCORM content not found");
    }

    if (filePath.endsWith(".html")) {
      const s3Key = `${metadata.s3Key}/${filePath}`;
      const htmlContent = await this.s3Service.getFileContent(s3Key);

      const dom = new JSDOM(htmlContent, {
        url: `${baseUrl}/api/scorm/${courseId}/content`,
      });
      const document = dom.window.document;
      const styles = document.querySelectorAll("style");
      for (const style of styles) {
        if (style.textContent) {
          style.textContent = await this.processStyleContent(
            style.textContent,
            filePath,
            metadata.s3Key,
          );
        }
      }

      const linkStyles = document.querySelectorAll('link[rel="stylesheet"]');
      for (const link of linkStyles) {
        const href = link.getAttribute("href");
        if (href) {
          const absolutePath = this.resolveRelativePath(filePath, href);
          const signedUrl = await this.s3Service.getSignedUrl(`${metadata.s3Key}/${absolutePath}`);
          link.setAttribute("href", signedUrl);
        }
      }

      const elements = document.querySelectorAll("[src]");
      for (const element of elements) {
        const src = element.getAttribute("src");
        if (src) {
          const absolutePath = this.resolveRelativePath(filePath, src);
          const signedUrl = await this.s3Service.getSignedUrl(`${metadata.s3Key}/${absolutePath}`);
          element.setAttribute("src", signedUrl);
        }
      }

      return dom.serialize();
    }

    const s3Key = `${metadata.s3Key}/${filePath}`;
    return await this.s3Service.getFileContent(s3Key);
  }

  /**
   * Process CSS content to handle @import rules and url() functions
   */
  private async processStyleContent(
    css: string,
    basePath: string,
    s3KeyPrefix: string,
  ): Promise<string> {
    return await this.replaceAsync(
      css,
      /@import\s+(?:url\(['"]?([^'"]+)['"]?\)|['"]([^'"]+)['"]);/g,
      async (fullMatch, urlImport, stringImport) => {
        const importPath = (urlImport || stringImport)?.trim();
        if (!importPath) return fullMatch;

        const absolutePath = this.resolveRelativePath(basePath, importPath);
        try {
          const importedContent = await this.s3Service.getFileContent(
            `${s3KeyPrefix}/${absolutePath}`,
          );

          const processedCss = await this.processStyleContent(
            importedContent.toString(),
            absolutePath,
            s3KeyPrefix,
          );

          return processedCss;
        } catch (error) {
          console.warn(`Failed to process CSS import: ${importPath}`, error);
          return fullMatch;
        }
      },
    );
  }

  /**
   * Get SCORM metadata for a specific course
   *
   * @param courseId - Course ID to get SCORM metadata for
   * @throws NotFoundException if no SCORM content exists for the course
   * @returns SCORM metadata including version, entry point, and file location
   */
  async getCourseScormMetadata(courseId: UUIDType) {
    try {
      const metadata = await this.scormRepository.getScormMetadata(courseId);

      if (!metadata) {
        throw new NotFoundException(`No SCORM content found for course ${courseId}`);
      }

      return metadata;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching SCORM metadata:", error);
      throw new NotFoundException(`No SCORM content found for course ${courseId}`);
    }
  }

  private resolveRelativePath(basePath: string, relativePath: string): string {
    basePath = basePath.trim();
    relativePath = relativePath.trim();

    if (relativePath.startsWith("/")) {
      return relativePath.slice(1);
    }

    const baseDir = path.dirname(basePath);
    if (relativePath.startsWith("../")) {
      const parts = baseDir.split("/");
      const relParts = relativePath.split("/");

      const upCount = relParts.reduce((count, part) => (part === ".." ? count + 1 : count), 0);

      const newBase = parts.slice(0, Math.max(0, parts.length - upCount));
      return [...newBase, ...relParts.slice(upCount)].join("/");
    }

    return path.join(path.dirname(basePath), relativePath);
  }

  private async replaceAsync(
    str: string,
    regex: RegExp,
    asyncFn: (...args: string[]) => Promise<string>,
  ) {
    const promises: Promise<string>[] = [];
    str.replace(regex, (match, ...args) => {
      promises.push(asyncFn(match, ...args));
      return match;
    });
    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift() || "");
  }

  /**
   * Extracts and validates SCORM manifest.
   * Each SCORM package must have imsmanifest.xml in root directory.
   * This file defines:
   * - SCORM version (1.2 or 2004)
   * - Course structure and sequence
   * - Files and dependencies
   * - Entry point (first SCO)
   *
   * @throws BadRequestException if:
   * - ZIP doesn't contain imsmanifest.xml
   * - Manifest is malformed
   * - Required fields are missing
   */
  private async parseAndValidateScorm(file: Express.Multer.File) {
    const zip = new AdmZip(file.buffer);

    const manifestEntry = zip.getEntry("imsmanifest.xml");
    if (!manifestEntry) {
      throw new BadRequestException("Invalid SCORM package - missing manifest");
    }

    const manifestContent = manifestEntry.getData().toString("utf8");
    const manifest = await xml2js.parseStringPromise(manifestContent);

    return {
      manifest,
      version: this.detectScormVersion(manifest),
      entryPoint: this.findEntryPoint(manifest),
      entries: zip.getEntries(),
    };
  }

  /**
   * Detects SCORM version from manifest.
   * Two main versions exist:
   * - SCORM 1.2: older but widely used
   * - SCORM 2004: newer with advanced sequencing
   *
   * Version is specified in manifest:
   * <metadata>
   *   <schemaversion>1.2</schemaversion>  // or "2004 3rd Edition" etc.
   * </metadata>
   *
   * Defaults to 1.2 if version can't be determined as it's more widely compatible.
   */
  private detectScormVersion(manifest: any): string {
    const schemaVersion = manifest?.manifest?.metadata?.[0]?.schemaversion?.[0];
    if (schemaVersion?.includes("1.2")) return "1.2";
    if (schemaVersion?.includes("2004")) return "2004";
    return "1.2";
  }

  /**
   * Finds first SCO (Sharable Content Object) to use as entry point.
   *
   * SCO is an HTML page that:
   * - Communicates with LMS through SCORM API
   * - Can save student's progress
   * - Can save test/quiz results
   * - Can track time spent on page
   *
   * Example: you have course with 5 lessons, each lesson is a separate SCO that:
   * - Saves whether student completed the lesson
   * - Saves quiz results at the end
   * - Remembers where student stopped (to return to the same place)
   *
   * In manifest.xml SCO is marked with special attribute:
   * SCORM 1.2:
   * <resource type="webcontent" adlcp:scormtype="sco" href="index.html"/>
   *
   * SCORM 2004:
   * <resource type="webcontent" adlcp:scormType="sco" href="index.html"/>
   *
   * Other resources (like images) are "asset" type and can't communicate with LMS.
   *
   * @throws BadRequestException if no SCO found (package must have at least one)
   */
  private findEntryPoint(manifest: any): string {
    const resources = manifest?.manifest?.resources?.[0]?.resource;
    const sco = resources?.find(
      (resource: any) =>
        resource.$["adlcp:scormtype"]?.toLowerCase() === SCORM.SCO ||
        resource.$["adlcp:scormType"]?.toLowerCase() === SCORM.SCO,
    );

    if (!sco || !sco.$?.href) {
      throw new BadRequestException("Invalid SCORM package - no entry point found");
    }

    return sco.$.href;
  }

  private parseScormStructure(manifest: any): ScormChapter[] {
    const organization = manifest.manifest.organizations[0].organization[0];
    const resources = manifest.manifest.resources[0].resource;

    const resourceMap = new Map(
      resources.map((resource: any) => [
        resource.$.identifier,
        {
          href: resource.$.href,
          type: resource.$.type,
          scormtype: resource.$["adlcp:scormtype"],
        },
      ]),
    );

    const items = Array.isArray(organization.item) ? organization.item : [organization.item];

    return items.map((chapterItem: any, chapterIndex: number) => {
      const subItems = chapterItem.item
        ? Array.isArray(chapterItem.item)
          ? chapterItem.item
          : [chapterItem.item]
        : [
            {
              $: {
                identifier: chapterItem.$.identifier,
                identifierref: chapterItem.$.identifierref,
              },
              title: chapterItem.title,
            },
          ];

      const lessons = subItems.map((lessonItem: any, lessonIndex: number) => {
        const resourceId = lessonItem.$.identifierref;
        const resource = resourceMap.get(resourceId);
        const lessonTitle = Array.isArray(lessonItem.title)
          ? lessonItem.title[0]
          : lessonItem.title;
        const isQuiz = lessonTitle.toLowerCase().includes("quiz");

        return {
          title: lessonTitle,
          identifier: lessonItem.$.identifier,
          // @ts-expect-error tet
          href: resource?.href || "",
          // @ts-expect-error tet
          type: isQuiz ? LESSON_TYPES.quiz : this.determineLessonType(resource?.href || ""),
          displayOrder: lessonIndex + 1,
          isQuiz,
        };
      });

      return {
        title: Array.isArray(chapterItem.title) ? chapterItem.title[0] : chapterItem.title,
        identifier: chapterItem.$.identifier,
        displayOrder: chapterIndex + 1,
        lessons,
      };
    });
  }

  private determineLessonType(href: string): string {
    const extension = path.extname(href).toLowerCase();

    return match(extension)
      .with(".mp4", ".webm", () => LESSON_TYPES.VIDEO)
      .with(".pptx", ".ppt", () => LESSON_TYPES.PRESENTATION)
      .otherwise(() => LESSON_TYPES.TEXT);
  }

  /**
   * Maps file extensions to MIME types.
   * Correct MIME types are required for:
   * - Browser to properly handle files
   * - S3 to serve files correctly
   * - SCORM API scripts to execute
   *
   * Common SCORM files:
   * - .html - Main content
   * - .js - SCORM API implementation
   * - .css - Styling
   * - .jpg/.png - Images
   */
  public getContentType(filename: string): string {
    const map: Record<string, string> = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".jpg": "image/jpeg",
      ".png": "image/png",
    };

    const ext = filename.toLowerCase().split(".").pop();
    return map[`.${ext}`] || "application/octet-stream";
  }
}
