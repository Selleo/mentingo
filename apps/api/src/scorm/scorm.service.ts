import { randomUUID } from "node:crypto";
import path from "node:path";

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PERMISSIONS,
  SCORM_COMPLETION_STATUS,
  SCORM_PACKAGE_STATUS,
  SCORM_STANDARD,
  SCORM_SUCCESS_STATUS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import AdmZip from "adm-zip";
import { load as loadHtml } from "cheerio";

import { DatabasePg } from "src/common";
import { CourseService } from "src/courses/course.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { S3Service } from "src/s3/s3.service";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";

import { PROMISE_SETTLED_STATUS } from "./promise-settled-status";
import { ScormRepository } from "./repositories/scorm.repository";
import { resolveScormContentType } from "./scorm-content-type";
import {
  MAX_SCORM_EXTRACTED_FILE_COUNT,
  MAX_SCORM_TOTAL_UNCOMPRESSED_SIZE_BYTES,
} from "./scorm-package-limits";
import {
  SCORM_1_2_CMI_KEYS,
  SCORM_1_2_ALLOWED_RUNTIME_KEY_PATTERNS,
  SCORM_1_2_INITIAL_ENTRY,
  SCORM_1_2_LESSON_STATUS,
  SCORM_1_2_VALUE_LIMITS,
} from "./scorm-runtime.constants";
import {
  getScormExtractedFileReference,
  getScormExtractedFilesReference,
  getScormManifestReference,
  getScormOriginalFileReference,
  joinScormRelativePath,
  normalizeScormRelativePath,
} from "./scorm-storage-paths";
import { addScorm12Times, SCORM_ZERO_TIME } from "./scorm-time";

import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
  CreateScormCourseImportParams,
  CreateScormLessonImportParams,
  ParsedScormManifest,
  PreparedPackageArtifacts,
  ScormItemManifest,
  ScormRuntimeCommitParams,
  ScormRuntimeFinishParams,
  ScormRuntimeLaunchParams,
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
    private readonly studentLessonProgressService: StudentLessonProgressService,
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

  async launchRuntime({ lessonId, scoId, currentUser }: ScormRuntimeLaunchParams) {
    const launchableSco = await this.scormRepository.findLaunchableSco({
      lessonId,
      scoId,
      tenantId: currentUser.tenantId,
    });

    if (!launchableSco || launchableSco.lessonType !== LESSON_TYPES.SCORM) {
      throw new NotFoundException("adminScorm.errors.runtime.launchNotFound");
    }

    if (launchableSco.standard !== SCORM_STANDARD.SCORM_1_2) {
      throw new BadRequestException("adminScorm.errors.runtime.unsupportedStandard");
    }

    await this.studentLessonProgressService.markLessonAsStarted(
      launchableSco.lessonId,
      currentUser.userId,
      currentUser.permissions,
    );

    const { attempt, isNewAttempt } = await this.scormRepository.findOrCreateAttempt({
      studentId: currentUser.userId,
      courseId: launchableSco.courseId,
      lessonId: launchableSco.lessonId,
      packageId: launchableSco.packageId,
      scoId: launchableSco.scoId,
      tenantId: currentUser.tenantId,
    });
    const runtimeState = await this.scormRepository.findRuntimeState(
      attempt.id,
      currentUser.tenantId,
    );
    const navigation = await this.scormRepository.findScoNavigation({
      packageId: launchableSco.packageId,
      lessonId: launchableSco.lessonId,
      scoId: launchableSco.scoId,
    });

    return {
      attemptId: attempt.id,
      packageId: launchableSco.packageId,
      scoId: launchableSco.scoId,
      lessonId: launchableSco.lessonId,
      courseId: launchableSco.courseId,
      launchUrl: this.buildContentUrl(
        launchableSco.packageId,
        launchableSco.extractedFilesReference,
        launchableSco.launchPath,
      ),
      scoTitle: launchableSco.scoTitle,
      navigation,
      runtime: this.buildInitialRuntimeState(runtimeState?.rawCmiJson, !isNewAttempt),
    };
  }

  async commitRuntime(params: ScormRuntimeCommitParams | ScormRuntimeFinishParams) {
    const { body, currentUser, finish } = params;

    const attemptContext = await this.scormRepository.findAttemptContext({
      attemptId: body.attemptId,
      tenantId: currentUser.tenantId,
    });

    if (
      !attemptContext ||
      attemptContext.studentId !== currentUser.userId ||
      attemptContext.packageId !== body.packageId ||
      attemptContext.scoId !== body.scoId ||
      attemptContext.lessonId !== body.lessonId ||
      attemptContext.courseId !== body.courseId ||
      attemptContext.scoLessonId !== body.lessonId
    ) {
      throw new BadRequestException("adminScorm.errors.runtime.invalidAttempt");
    }

    this.assertRuntimeValues(body.values);

    const existingRuntimeState = await this.scormRepository.findRuntimeState(
      body.attemptId,
      currentUser.tenantId,
    );
    const mergedCmiJson = {
      ...this.asRuntimeJson(existingRuntimeState?.rawCmiJson),
      ...body.values,
    };
    const shouldRollupSessionTime = finish && !attemptContext.completedAt;

    if (shouldRollupSessionTime) {
      mergedCmiJson[SCORM_1_2_CMI_KEYS.TOTAL_TIME] = addScorm12Times(
        existingRuntimeState?.totalTime,
        mergedCmiJson[SCORM_1_2_CMI_KEYS.SESSION_TIME],
      );
    }

    const normalizedRuntimeState = this.normalizeRuntimeState(mergedCmiJson);

    await this.scormRepository.upsertRuntimeState({
      attemptId: body.attemptId,
      tenantId: currentUser.tenantId,
      rawCmiJson: mergedCmiJson,
      ...normalizedRuntimeState,
    });

    const scoCompleted =
      normalizedRuntimeState.completionStatus === SCORM_COMPLETION_STATUS.COMPLETED;

    if (finish || scoCompleted) {
      await this.scormRepository.markAttemptCompleted(body.attemptId, currentUser.tenantId);
    }

    let lessonCompleted = false;

    if (scoCompleted) {
      lessonCompleted = await this.scormRepository.areAllLessonScosCompleted({
        studentId: currentUser.userId,
        packageId: body.packageId,
        lessonId: body.lessonId,
        tenantId: currentUser.tenantId,
        completedStatuses: [SCORM_COMPLETION_STATUS.COMPLETED],
      });

      if (lessonCompleted) {
        await this.studentLessonProgressService.markLessonAsCompleted({
          id: body.lessonId,
          studentId: currentUser.userId,
          userPermissions: currentUser.permissions,
          actor: currentUser,
          language: body.language ?? SUPPORTED_LANGUAGES.EN,
        });
      }
    }

    const navigation = await this.scormRepository.findScoNavigation({
      packageId: body.packageId,
      lessonId: body.lessonId,
      scoId: body.scoId,
    });

    return {
      lessonCompleted,
      scormStatus: mergedCmiJson[SCORM_1_2_CMI_KEYS.LESSON_STATUS] ?? null,
      nextScoId: navigation.nextScoId,
    };
  }

  async getContentFile(params: {
    packageId: UUIDType;
    relativePath: string;
    currentUser: CurrentUserType;
    range?: string;
  }) {
    const scormPackage = await this.scormRepository.findPackageById(
      params.packageId,
      params.currentUser.tenantId,
    );

    if (!scormPackage || scormPackage.status !== SCORM_PACKAGE_STATUS.READY) {
      throw new NotFoundException("adminScorm.errors.runtime.contentNotFound");
    }

    await this.assertPackageContentAccess(params.packageId, params.currentUser);

    const objectReference = getScormExtractedFileReference(
      params.currentUser.tenantId,
      params.packageId,
      this.stripLaunchSuffix(params.relativePath).path,
    );

    try {
      return await this.s3Service.getFileStream(objectReference, params.range);
    } catch (error) {
      if (this.isMissingS3ObjectError(error)) {
        throw new NotFoundException("adminScorm.errors.runtime.contentNotFound");
      }

      throw new InternalServerErrorException("adminScorm.errors.runtime.contentNotFound");
    }
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
    const selectedOrganization = this.getSelectedOrganization($, defaultOrganizationIdentifier);

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

  private getSelectedOrganization(
    $: ReturnType<typeof loadHtml>,
    defaultOrganizationIdentifier?: string,
  ) {
    if (!defaultOrganizationIdentifier) {
      return $("organization").first();
    }

    const defaultOrganization = $(
      `organization[identifier="${defaultOrganizationIdentifier}"]`,
    ).first();

    if (defaultOrganization.length) {
      return defaultOrganization;
    }

    return $("organization").first();
  }

  private buildResourceBasePath(manifestBasePath: string, xmlBase?: string) {
    if (!manifestBasePath && !xmlBase) {
      return "";
    }

    return joinScormRelativePath(manifestBasePath, xmlBase);
  }

  private getResourceScormType(resource: { attr(name: string): string | undefined }) {
    const scormType =
      resource.attr("adlcp:scormtype") ||
      resource.attr("adlcp:scormType") ||
      resource.attr("scormtype");

    if (!scormType) {
      return undefined;
    }

    return scormType;
  }

  private buildResourceHref(resourceBasePath: string, hrefPath?: string) {
    if (!hrefPath) {
      return undefined;
    }

    return joinScormRelativePath(resourceBasePath, hrefPath);
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
        const resourceBasePath = this.buildResourceBasePath(manifestBasePath, xmlBase);
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
          scormType: this.getResourceScormType(resource),
          href: this.buildResourceHref(resourceBasePath, hrefPath),
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
            launchPath: this.buildScoLaunchPath(resource.href, item.parameters),
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

  private buildScoLaunchPath(resourceHref: string, parameters?: string) {
    if (!parameters) {
      return resourceHref;
    }

    return `${resourceHref}${parameters}`;
  }

  private resolveResourceFiles(
    resource: ScormResourceManifest,
    resourceMap: Map<string, ScormResourceManifest>,
    visited = new Set<string>(),
  ): string[] {
    if (visited.has(resource.identifier)) {
      return [];
    }

    visited.add(resource.identifier);

    const dependencyFiles = resource.dependencies.flatMap((dependencyIdentifier) => {
      const dependency = resourceMap.get(dependencyIdentifier);

      if (!dependency) {
        return [];
      }

      return this.resolveResourceFiles(dependency, resourceMap, visited);
    });
    const resourceFiles = [...resource.files];

    if (resource.href) {
      resourceFiles.unshift(resource.href);
    }

    return [...new Set([...resourceFiles, ...dependencyFiles])];
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

  private buildContentUrl(
    packageId: UUIDType,
    extractedFilesReference: string,
    launchPath: string,
  ) {
    const relativeLaunchPath = this.stripExtractedFilesReference(
      extractedFilesReference,
      launchPath,
    );
    const { path: launchFilePath, suffix } = this.stripLaunchSuffix(relativeLaunchPath);

    return `/api/scorm/content/${packageId}/${this.encodeRelativeUrlPath(launchFilePath)}${suffix}`;
  }

  private stripExtractedFilesReference(extractedFilesReference: string, launchPath: string) {
    const extractedPrefix = `${extractedFilesReference}/`;

    if (!launchPath.startsWith(extractedPrefix)) {
      return launchPath;
    }

    return launchPath.slice(extractedPrefix.length);
  }

  private encodeRelativeUrlPath(relativePath: string) {
    return normalizeScormRelativePath(relativePath).split("/").map(encodeURIComponent).join("/");
  }

  private stripLaunchSuffix(relativePath: string) {
    const suffixIndex = relativePath.search(/[?#]/);

    if (suffixIndex === -1) {
      return { path: relativePath, suffix: "" };
    }

    return {
      path: relativePath.slice(0, suffixIndex),
      suffix: relativePath.slice(suffixIndex),
    };
  }

  private buildInitialRuntimeState(rawCmiJson: unknown, isResume: boolean) {
    const runtimeJson = this.asRuntimeJson(rawCmiJson);

    return {
      [SCORM_1_2_CMI_KEYS.LESSON_STATUS]:
        runtimeJson[SCORM_1_2_CMI_KEYS.LESSON_STATUS] ?? SCORM_1_2_LESSON_STATUS.NOT_ATTEMPTED,
      [SCORM_1_2_CMI_KEYS.ENTRY]: this.getInitialRuntimeEntry(isResume),
      [SCORM_1_2_CMI_KEYS.TOTAL_TIME]:
        runtimeJson[SCORM_1_2_CMI_KEYS.TOTAL_TIME] ?? SCORM_ZERO_TIME,
      ...runtimeJson,
    };
  }

  private getInitialRuntimeEntry(isResume: boolean) {
    if (isResume) {
      return SCORM_1_2_INITIAL_ENTRY.RESUME;
    }

    return SCORM_1_2_INITIAL_ENTRY.NEW;
  }

  private asRuntimeJson(rawCmiJson: unknown): Record<string, string> {
    if (!rawCmiJson || typeof rawCmiJson !== "object" || Array.isArray(rawCmiJson)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(rawCmiJson).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === "string" && typeof entry[1] === "string",
      ),
    );
  }

  private assertRuntimeValues(values: Record<string, string>) {
    for (const [key, value] of Object.entries(values)) {
      if (!this.isWritableScormRuntimeKey(key) || !this.isValidRuntimeValueLength(key, value)) {
        throw new BadRequestException("adminScorm.errors.runtime.invalidCmiValue");
      }
    }
  }

  private isWritableScormRuntimeKey(key: string) {
    return SCORM_1_2_ALLOWED_RUNTIME_KEY_PATTERNS.some((pattern) => pattern.test(key));
  }

  private isValidRuntimeValueLength(key: string, value: string) {
    const maxLength = this.getRuntimeValueMaxLength(key);

    return value.length <= maxLength;
  }

  private getRuntimeValueMaxLength(key: string) {
    switch (key) {
      case SCORM_1_2_CMI_KEYS.SUSPEND_DATA:
        return SCORM_1_2_VALUE_LIMITS.SUSPEND_DATA_MAX_LENGTH;
      case SCORM_1_2_CMI_KEYS.LESSON_LOCATION:
        return SCORM_1_2_VALUE_LIMITS.LESSON_LOCATION_MAX_LENGTH;
      case SCORM_1_2_CMI_KEYS.EXIT:
        return SCORM_1_2_VALUE_LIMITS.EXIT_MAX_LENGTH;
      default:
        return SCORM_1_2_VALUE_LIMITS.DEFAULT_MAX_LENGTH;
    }
  }

  private normalizeRuntimeState(values: Record<string, string>) {
    const lessonStatus = values[SCORM_1_2_CMI_KEYS.LESSON_STATUS];

    return {
      completionStatus: this.resolveCompletionStatus(lessonStatus),
      successStatus: this.resolveSuccessStatus(lessonStatus),
      scoreRaw: this.normalizeRuntimeNumericValue(values[SCORM_1_2_CMI_KEYS.SCORE_RAW]),
      scoreMin: this.normalizeRuntimeNumericValue(values[SCORM_1_2_CMI_KEYS.SCORE_MIN]),
      scoreMax: this.normalizeRuntimeNumericValue(values[SCORM_1_2_CMI_KEYS.SCORE_MAX]),
      lessonLocation: values[SCORM_1_2_CMI_KEYS.LESSON_LOCATION] ?? null,
      suspendData: values[SCORM_1_2_CMI_KEYS.SUSPEND_DATA] ?? null,
      sessionTime: values[SCORM_1_2_CMI_KEYS.SESSION_TIME] ?? null,
      totalTime: values[SCORM_1_2_CMI_KEYS.TOTAL_TIME] ?? null,
      entry: values[SCORM_1_2_CMI_KEYS.ENTRY] ?? null,
      exit: values[SCORM_1_2_CMI_KEYS.EXIT] ?? null,
    };
  }

  private normalizeRuntimeNumericValue(value?: string) {
    if (!value) {
      return null;
    }

    const trimmedValue = value.trim();

    if (!trimmedValue || !/^[+-]?\d+(\.\d+)?$/u.test(trimmedValue)) {
      return null;
    }

    return trimmedValue;
  }

  private resolveCompletionStatus(lessonStatus?: string) {
    switch (lessonStatus) {
      case SCORM_1_2_LESSON_STATUS.COMPLETED:
      case SCORM_1_2_LESSON_STATUS.PASSED:
        return SCORM_COMPLETION_STATUS.COMPLETED;
      case SCORM_1_2_LESSON_STATUS.INCOMPLETE:
        return SCORM_COMPLETION_STATUS.INCOMPLETE;
      case SCORM_1_2_LESSON_STATUS.NOT_ATTEMPTED:
        return SCORM_COMPLETION_STATUS.NOT_ATTEMPTED;
      default:
        return SCORM_COMPLETION_STATUS.UNKNOWN;
    }
  }

  private resolveSuccessStatus(lessonStatus?: string) {
    switch (lessonStatus) {
      case SCORM_1_2_LESSON_STATUS.PASSED:
        return SCORM_SUCCESS_STATUS.PASSED;
      case SCORM_1_2_LESSON_STATUS.FAILED:
        return SCORM_SUCCESS_STATUS.FAILED;
      default:
        return SCORM_SUCCESS_STATUS.UNKNOWN;
    }
  }

  private async assertPackageContentAccess(packageId: UUIDType, currentUser: CurrentUserType) {
    if (currentUser.permissions.includes(PERMISSIONS.LEARNING_MODE_USE)) return;

    const access = await this.scormRepository.findPackageAccess(packageId, currentUser.userId);

    if (!access || (!access.isAssigned && !access.isFreemium)) {
      throw new ForbiddenException("adminScorm.errors.runtime.contentForbidden");
    }
  }

  private isMissingS3ObjectError(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      ("name" in error || "Code" in error) &&
      ((error as { name?: string }).name === "NoSuchKey" ||
        (error as { Code?: string }).Code === "NoSuchKey")
    );
  }
}
