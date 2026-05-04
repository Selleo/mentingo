import { randomUUID } from "node:crypto";
import path from "node:path";

import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import AdmZip from "adm-zip";
import { load as loadHtml } from "cheerio";

import { DatabasePg } from "src/common";
import { CourseService } from "src/courses/course.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { S3Service } from "src/s3/s3.service";

import { PROMISE_SETTLED_STATUS } from "./promise-settled-status";
import { ScormRepository } from "./repositories/scorm.repository";
import { resolveScormContentType } from "./scorm-content-type";
import {
  MAX_SCORM_EXTRACTED_FILE_COUNT,
  MAX_SCORM_TOTAL_UNCOMPRESSED_SIZE_BYTES,
} from "./scorm-package-limits";
import {
  getScormExtractedFileReference,
  getScormExtractedFilesReference,
  getScormManifestReference,
  getScormOriginalFileReference,
  joinScormRelativePath,
  normalizeScormRelativePath,
} from "./scorm-storage-paths";

import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
  CreateScormCourseImportParams,
  CreateScormLessonImportParams,
  ParsedScormManifest,
  PreparedPackageArtifacts,
  ScormItemManifest,
  ScormResourceManifest,
  ScormScoManifest,
} from "src/scorm/scorm.types";

@Injectable()
export class ScormService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly scormRepository: ScormRepository,
    private readonly s3Service: S3Service,
    private readonly courseService: CourseService,
    private readonly adminLessonService: AdminLessonService,
  ) {}

  async createCourseImport({
    scormPackage,
    metadata,
    currentUser,
    isPlaywrightTest,
  }: CreateScormCourseImportParams) {
    if (!scormPackage?.buffer?.length) {
      throw new BadRequestException("adminScorm.errors.packageRequired");
    }

    const artifacts = this.preparePackageArtifacts(scormPackage, currentUser);
    const course = await this.db.transaction(async (trx) => {
      const createdCourse = await this.courseService.createCourseInTransaction(
        {
          ...metadata,
          status: metadata.status ?? "draft",
          isScorm: true,
        },
        currentUser,
        isPlaywrightTest,
        trx,
      );

      await this.scormRepository.persistCoursePackage(
        {
          courseId: createdCourse.id,
          packageId: artifacts.packageId,
          metadata,
          manifest: artifacts.manifest,
          originalFileReference: artifacts.originalFileReference,
          extractedFilesReference: artifacts.extractedFilesReference,
          manifestEntryPoint: artifacts.manifest.scos[0].launchPath,
          manifestReference: artifacts.manifestReference,
          currentUser,
        },
        trx,
      );

      return createdCourse;
    });

    let uploadedReferences: string[] = [];

    try {
      uploadedReferences = await this.uploadPackageFiles(artifacts, currentUser.tenantId);
      await this.scormRepository.markPackageReady(artifacts.packageId, currentUser.tenantId);
    } catch (error) {
      await this.deleteUploadedPackageFiles(uploadedReferences);
      await this.scormRepository.deleteImportedCourse(course.id, currentUser.tenantId);
      throw error;
    }

    await this.courseService.publishCreateCourseEvent(course.id, metadata.language, currentUser);

    return {
      id: course.id,
      packageId: artifacts.packageId,
      fileName: scormPackage.originalname,
      fileSize: scormPackage.size,
      mimeType: scormPackage.mimetype,
      scoCount: artifacts.manifest.scos.length,
    };
  }

  async createLessonImport({ scormPackage, metadata, currentUser }: CreateScormLessonImportParams) {
    if (!scormPackage?.buffer?.length) {
      throw new BadRequestException("adminScorm.errors.packageRequired");
    }

    const artifacts = this.preparePackageArtifacts(scormPackage, currentUser);
    const createdLesson = await this.db.transaction(async (trx) => {
      const lesson = await this.adminLessonService.createLessonForChapterInTransaction(
        {
          chapterId: metadata.chapterId,
          title: metadata.title,
          description: "",
          type: LESSON_TYPES.SCORM,
        },
        currentUser,
        trx,
      );

      await this.scormRepository.persistLessonPackage(
        {
          lessonId: lesson.lessonId,
          packageId: artifacts.packageId,
          manifest: artifacts.manifest,
          originalFileReference: artifacts.originalFileReference,
          extractedFilesReference: artifacts.extractedFilesReference,
          manifestEntryPoint: artifacts.manifest.scos[0].launchPath,
          manifestReference: artifacts.manifestReference,
          currentUser,
        },
        trx,
      );

      return lesson;
    });

    let uploadedReferences: string[] = [];

    try {
      uploadedReferences = await this.uploadPackageFiles(artifacts, currentUser.tenantId);
      await this.scormRepository.markPackageReady(artifacts.packageId, currentUser.tenantId);
    } catch (error) {
      await this.deleteUploadedPackageFiles(uploadedReferences);
      await this.scormRepository.deleteImportedLesson(createdLesson.lessonId, currentUser.tenantId);
      throw error;
    }

    await this.adminLessonService.publishCreateLessonEvent(
      createdLesson.lessonId,
      createdLesson.language,
      currentUser,
    );

    return {
      id: createdLesson.lessonId,
      packageId: artifacts.packageId,
      fileName: scormPackage.originalname,
      fileSize: scormPackage.size,
      mimeType: scormPackage.mimetype,
      scoCount: artifacts.manifest.scos.length,
    };
  }

  private preparePackageArtifacts(
    scormPackage: Express.Multer.File,
    currentUser: CurrentUserType,
  ): PreparedPackageArtifacts {
    const packageId = randomUUID();
    const zip = new AdmZip(scormPackage.buffer);
    const entries = this.getValidatedZipEntries(zip);
    const manifestEntry = this.getManifestEntry(entries);
    const parsedManifest = this.parseManifest(manifestEntry.getData().toString("utf-8"));
    const manifest = this.buildManifestModel(parsedManifest, manifestEntry.entryName);

    this.assertLaunchFilesExist(manifest, entries);

    const originalFileReference = getScormOriginalFileReference(
      currentUser.tenantId,
      packageId,
      scormPackage.originalname,
    );
    const extractedFilesReference = getScormExtractedFilesReference(
      currentUser.tenantId,
      packageId,
    );
    const manifestReference = getScormManifestReference(
      currentUser.tenantId,
      packageId,
      manifest.manifestPath,
    );

    return {
      packageId,
      entries,
      manifest,
      originalFileReference,
      extractedFilesReference,
      manifestReference,
      originalFile: scormPackage,
    };
  }

  private getValidatedZipEntries(zip: AdmZip) {
    const entries = zip.getEntries();

    if (!entries.length) {
      throw new BadRequestException("adminScorm.errors.emptyPackage");
    }

    const fileEntries = entries.filter((entry) => !entry.isDirectory);

    if (fileEntries.length > MAX_SCORM_EXTRACTED_FILE_COUNT) {
      throw new BadRequestException("adminScorm.errors.tooManyFiles");
    }

    let totalUncompressedSize = 0;

    for (const entry of fileEntries) {
      normalizeScormRelativePath(entry.entryName);
      totalUncompressedSize += entry.header.size;
    }

    if (totalUncompressedSize > MAX_SCORM_TOTAL_UNCOMPRESSED_SIZE_BYTES) {
      throw new BadRequestException("adminScorm.errors.packageTooLarge");
    }

    return entries;
  }

  private getManifestEntry(entries: AdmZip.IZipEntry[]) {
    const manifestEntries = entries.filter(
      (entry) =>
        !entry.isDirectory &&
        path.posix.basename(entry.entryName.toLowerCase()) === "imsmanifest.xml",
    );

    if (!manifestEntries.length) {
      throw new BadRequestException("adminScorm.errors.manifestMissing");
    }

    return manifestEntries[0];
  }

  private parseManifest(manifestXml: string) {
    try {
      return loadHtml(manifestXml, { xmlMode: true });
    } catch {
      throw new BadRequestException("adminScorm.errors.manifestInvalid");
    }
  }

  private buildManifestModel(
    $: ReturnType<typeof loadHtml>,
    rawManifestPath: string,
  ): ParsedScormManifest {
    const manifestPath = normalizeScormRelativePath(rawManifestPath);
    const manifestBasePath =
      path.posix.dirname(manifestPath) === "." ? "" : path.posix.dirname(manifestPath);
    const manifestElement = $("manifest").first();
    const organizationsElement = $("organizations").first();
    const defaultOrganizationIdentifier = organizationsElement.attr("default") || undefined;
    const selectedOrganization =
      (defaultOrganizationIdentifier
        ? $(`organization[identifier="${defaultOrganizationIdentifier}"]`).first()
        : $("organization").first()) || $("organization").first();

    if (!selectedOrganization.length) {
      throw new BadRequestException("adminScorm.errors.organizationMissing");
    }

    const resources = this.parseResources($, manifestBasePath);
    const resourceMap = new Map(resources.map((resource) => [resource.identifier, resource]));
    const items = selectedOrganization
      .children("item")
      .toArray()
      .map((item) => this.parseItem($, item));
    const scos = this.buildLaunchableScos(items, resourceMap);

    if (!scos.length) {
      throw new BadRequestException("adminScorm.errors.scoMissing");
    }

    const title =
      selectedOrganization.children("title").first().text().trim() ||
      manifestElement.attr("identifier") ||
      "SCORM package";

    return {
      manifestPath,
      manifestIdentifier: manifestElement.attr("identifier") || undefined,
      version: manifestElement.children("metadata").children("schemaversion").first().text().trim(),
      defaultOrganizationIdentifier,
      organizationIdentifier: selectedOrganization.attr("identifier") || undefined,
      title,
      resources,
      items,
      scos,
    };
  }

  private parseResources($: ReturnType<typeof loadHtml>, manifestBasePath: string) {
    return $("resources > resource")
      .toArray()
      .map((resourceElement) => {
        const resource = $(resourceElement);
        const identifier = resource.attr("identifier");

        if (!identifier) {
          throw new BadRequestException("adminScorm.errors.resourceIdentifierMissing");
        }

        const xmlBase = resource.attr("xml:base") || resource.attr("base") || undefined;
        const href = resource.attr("href") || undefined;
        const hrefPath = href?.split(/[?#]/)[0];
        const resourceBasePath =
          manifestBasePath || xmlBase ? joinScormRelativePath(manifestBasePath, xmlBase) : "";
        const files = resource
          .children("file")
          .toArray()
          .map((fileElement) => {
            const fileHref = $(fileElement).attr("href");
            if (!fileHref) return undefined;
            return joinScormRelativePath(resourceBasePath, fileHref);
          })
          .filter((file): file is string => Boolean(file));

        const dependencies = resource
          .children("dependency")
          .toArray()
          .map((dependencyElement) => $(dependencyElement).attr("identifierref"))
          .filter((identifierRef): identifierRef is string => Boolean(identifierRef));

        return {
          identifier,
          type: resource.attr("type") || undefined,
          scormType:
            resource.attr("adlcp:scormtype") ||
            resource.attr("adlcp:scormType") ||
            resource.attr("scormtype") ||
            undefined,
          href: hrefPath ? joinScormRelativePath(resourceBasePath, hrefPath) : undefined,
          xmlBase,
          files,
          dependencies,
        };
      });
  }

  private parseItem(
    $: ReturnType<typeof loadHtml>,
    itemElement: Parameters<ReturnType<typeof loadHtml>>[0],
    parentIdentifier?: string,
  ): ScormItemManifest {
    const item = $(itemElement);
    const identifier = item.attr("identifier");

    if (!identifier) {
      throw new BadRequestException("adminScorm.errors.itemIdentifierMissing");
    }

    return {
      identifier,
      identifierRef: item.attr("identifierref") || undefined,
      title: item.children("title").first().text().trim() || identifier,
      parameters: item.attr("parameters") || undefined,
      isVisible: item.attr("isvisible") !== "false",
      parentIdentifier,
      children: item
        .children("item")
        .toArray()
        .map((child) => this.parseItem($, child, identifier)),
    };
  }

  private buildLaunchableScos(
    items: ScormItemManifest[],
    resourceMap: Map<string, ScormResourceManifest>,
  ) {
    const scos: ScormScoManifest[] = [];

    const visit = (item: ScormItemManifest) => {
      if (item.identifierRef) {
        const resource = resourceMap.get(item.identifierRef);
        const scormType = resource?.scormType?.toLowerCase();

        if (resource?.href && (!scormType || scormType === "sco")) {
          scos.push({
            item,
            resource,
            href: resource.href,
            launchPath: item.parameters ? `${resource.href}${item.parameters}` : resource.href,
            files: this.resolveResourceFiles(resource, resourceMap),
            displayOrder: scos.length + 1,
          });
        }
      }

      item.children.forEach(visit);
    };

    items.forEach(visit);

    return scos;
  }

  private resolveResourceFiles(
    resource: ScormResourceManifest,
    resourceMap: Map<string, ScormResourceManifest>,
    visited = new Set<string>(),
  ): string[] {
    if (visited.has(resource.identifier)) return [];
    visited.add(resource.identifier);

    const dependencyFiles = resource.dependencies.flatMap((dependencyIdentifier) => {
      const dependency = resourceMap.get(dependencyIdentifier);
      return dependency ? this.resolveResourceFiles(dependency, resourceMap, visited) : [];
    });

    return [
      ...new Set([
        ...(resource.href ? [resource.href] : []),
        ...resource.files,
        ...dependencyFiles,
      ]),
    ];
  }

  private assertLaunchFilesExist(manifest: ParsedScormManifest, entries: AdmZip.IZipEntry[]) {
    const fileEntryPaths = new Set(
      entries
        .filter((entry) => !entry.isDirectory)
        .map((entry) => normalizeScormRelativePath(entry.entryName)),
    );

    for (const sco of manifest.scos) {
      const launchPath = sco.href.split(/[?#]/)[0];
      if (!fileEntryPaths.has(launchPath)) {
        throw new BadRequestException("adminScorm.errors.launchFileMissing");
      }
    }
  }

  private async uploadPackageFiles(
    artifacts: PreparedPackageArtifacts,
    tenantId: UUIDType,
  ): Promise<string[]> {
    const uploadedReferences: string[] = [];

    await this.s3Service.uploadFile(
      artifacts.originalFile.buffer,
      artifacts.originalFileReference,
      artifacts.originalFile.mimetype || "application/zip",
    );
    uploadedReferences.push(artifacts.originalFileReference);

    const uploadResults = await Promise.allSettled(
      artifacts.entries
        .filter((entry) => !entry.isDirectory)
        .map(async (entry) => {
          const fileBuffer = entry.getData();
          const reference = getScormExtractedFileReference(
            tenantId,
            artifacts.packageId,
            entry.entryName,
          );

          await this.s3Service.uploadFile(
            fileBuffer,
            reference,
            await resolveScormContentType(fileBuffer, entry.entryName),
          );

          return reference;
        }),
    );

    for (const result of uploadResults) {
      if (result.status === PROMISE_SETTLED_STATUS.FULFILLED) {
        uploadedReferences.push(result.value);
      }
    }

    const failedUpload = uploadResults.find(
      (result): result is PromiseRejectedResult =>
        result.status === PROMISE_SETTLED_STATUS.REJECTED,
    );

    if (failedUpload) {
      await this.deleteUploadedPackageFiles(uploadedReferences);
      throw failedUpload.reason;
    }

    return uploadedReferences;
  }

  private async deleteUploadedPackageFiles(references: string[]) {
    await Promise.allSettled(references.map((reference) => this.s3Service.deleteFile(reference)));
  }
}
