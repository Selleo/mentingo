import { randomUUID } from "node:crypto";
import path from "node:path";
import { PassThrough, type Readable } from "node:stream";

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
  SCORM_IMPORT_ACTION,
  SCORM_IMPORT_SOCKET,
  SCORM_PACKAGE_STATUS,
  SCORM_STANDARD,
  SCORM_SUCCESS_STATUS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import AdmZip from "adm-zip";
import { load as loadHtml } from "cheerio";
import * as unzipper from "unzipper";

import { DatabasePg } from "src/common";
import { hasAnyPermission } from "src/common/permissions/permission.utils";
import { CourseService } from "src/courses/course.service";
import { FileService } from "src/file/file.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { S3Service } from "src/s3/s3.service";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";
import { WsGateway } from "src/websocket";

import { PROMISE_SETTLED_STATUS } from "./promise-settled-status";
import { ScormRepository } from "./repositories/scorm.repository";
import { resolveScormContentType, resolveScormContentTypeFromFilename } from "./scorm-content-type";
import {
  MAX_SCORM_EXTRACTED_FILE_COUNT,
  MAX_SCORM_PACKAGE_SIZE_BYTES,
  MAX_SCORM_TOTAL_UNCOMPRESSED_SIZE_BYTES,
} from "./scorm-package-limits";
import { ScormQueueService } from "./scorm-queue.service";
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
  getScormStagedUploadReference,
  joinScormRelativePath,
  normalizeScormRelativePath,
} from "./scorm-storage-paths";
import { addScorm12Times, SCORM_ZERO_TIME } from "./scorm-time";
import {
  SCORM_STREAMED_EXTRACTION_UPLOAD_CONCURRENCY,
  SCORM_TUS_EXPOSED_HEADERS,
  SCORM_TUS_VERSION,
} from "./scorm-tus-upload.constants";

import type { InitScormImportBody } from "./schemas/scormImport.schema";
import type { ScormTusUploadState } from "./scorm-tus-upload.types";
import type { ScormPackageStatus } from "@repo/shared";
import type { Request, Response } from "express";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
  AttachScormLessonPackageParams,
  CompleteTusImportParams,
  CompleteTusImportResult,
  CreateScormCourseImportParams,
  CreateScormLessonImportParams,
  InitTusImportParams,
  InitTusImportResult,
  ParsedScormManifest,
  PreparedPackageArtifacts,
  PreparedStreamedPackageArtifacts,
  QueuedScormPackageFile,
  AnyScormImportJobData,
  StreamedScormImportJobData,
  StreamedPackageUploadArtifacts,
  ScormImportJobData,
  ScormImportResult,
  ScormItemManifest,
  ScormRuntimeCommitParams,
  ScormRuntimeFinishParams,
  ScormRuntimeLaunchParams,
  ScormResourceManifest,
  ScormScoManifest,
} from "src/scorm/scorm.types";
import type { File as UnzipperFile } from "unzipper";

@Injectable()
export class ScormService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly scormRepository: ScormRepository,
    private readonly s3Service: S3Service,
    private readonly courseService: CourseService,
    private readonly adminLessonService: AdminLessonService,
    private readonly fileService: FileService,
    private readonly studentLessonProgressService: StudentLessonProgressService,
    private readonly wsGateway: WsGateway,
    private readonly scormQueueService: ScormQueueService,
  ) {}

  ensureTusVersion(req: Request) {
    if (req.headers["tus-resumable"] !== SCORM_TUS_VERSION) {
      throw new BadRequestException("adminScorm.errors.unsupportedTusVersion");
    }
  }

  parseTusMetadata(header?: string) {
    if (!header) return {};

    return Object.fromEntries(
      header.split(",").map((part) => {
        const [key, encodedValue] = part.trim().split(" ");
        if (!encodedValue) return [key, ""];

        return [key, Buffer.from(encodedValue, "base64").toString("utf8")];
      }),
    );
  }

  setTusHeaders(res: Response, extraHeaders: Record<string, string> = {}) {
    res.set({
      "Tus-Resumable": SCORM_TUS_VERSION,
      "Tus-Version": SCORM_TUS_VERSION,
      "Tus-Extension": "creation",
      "Tus-Max-Size": String(MAX_SCORM_PACKAGE_SIZE_BYTES),
      "Access-Control-Expose-Headers": SCORM_TUS_EXPOSED_HEADERS,
      ...extraHeaders,
    });
  }

  async resolveThumbnailS3Key(
    existingThumbnailS3Key: string | undefined,
    thumbnail: Express.Multer.File | undefined,
    currentUser: CurrentUserType,
  ) {
    if (existingThumbnailS3Key) return existingThumbnailS3Key;
    if (!thumbnail) return undefined;

    const uploadedFile = await this.fileService.uploadFile(
      thumbnail,
      "course",
      currentUser.tenantId,
    );
    return uploadedFile.fileKey;
  }

  async initTusImport(params: InitTusImportParams): Promise<InitTusImportResult> {
    this.assertTusImportPermission(params.importRequest, params.currentUser);

    const packageId = randomUUID() as UUIDType;
    const uploadId = packageId;
    const stagedFileReference = getScormStagedUploadReference(
      params.currentUser.tenantId,
      packageId,
      params.importRequest.filename,
    );
    const { uploadId: multipartUploadId } = await this.s3Service.createMultipartUpload(
      stagedFileReference,
      params.importRequest.mimeType || "application/zip",
    );

    return {
      packageId,
      uploadId,
      stagedFileReference,
      multipartUploadId,
    };
  }

  private assertTusImportPermission(
    importRequest: InitScormImportBody,
    currentUser: CurrentUserType,
  ) {
    const requiredPermissions = this.getTusImportRequiredPermissions(importRequest.action);

    if (!hasAnyPermission(currentUser.permissions, requiredPermissions)) {
      throw new ForbiddenException("auth.error.missingPermission");
    }
  }

  private getTusImportRequiredPermissions(action: InitScormImportBody["action"]) {
    switch (action) {
      case SCORM_IMPORT_ACTION.CREATE_COURSE:
        return [PERMISSIONS.COURSE_CREATE];
      case SCORM_IMPORT_ACTION.CREATE_LESSON:
      case SCORM_IMPORT_ACTION.ATTACH_LESSON_PACKAGE:
        return [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN];
    }
  }

  async completeTusImport(params: CompleteTusImportParams): Promise<CompleteTusImportResult> {
    const jobData = this.buildStreamedImportJobData(params.session, params.currentUser);

    const artifacts = await this.prepareStreamedPackageArtifacts(jobData);

    const result = await this.persistStreamedImport(jobData, artifacts);

    try {
      await this.enqueueScormImportJob({ ...jobData, result });
    } catch (error) {
      await this.deleteFailedQueuedImport(this.toLegacyNotificationJobData(jobData, result));
      throw error;
    }

    return result;
  }

  async createCourseImport({
    scormPackage,
    metadata,
    currentUser,
    isPlaywrightTest,
  }: CreateScormCourseImportParams): Promise<ScormImportResult> {
    const { packageId, queuedPackage } = await this.stagePackageForImport(
      scormPackage,
      currentUser.tenantId,
    );

    let courseId: UUIDType | undefined;
    let processingJobData: ScormImportJobData | undefined;

    try {
      const artifacts = this.preparePackageArtifacts(scormPackage, currentUser, packageId);

      let packageIds: UUIDType[] = [];

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

        packageIds = await this.scormRepository.persistCoursePackage(
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

      courseId = course.id;

      const result = this.buildImportResult({
        id: course.id,
        packageId: packageIds[0] ?? artifacts.packageId,
        scormPackage,
        scoCount: artifacts.manifest.scos.length,
      });

      const jobData = {
        action: SCORM_IMPORT_ACTION.CREATE_COURSE,
        packageId,
        scormPackage: queuedPackage,
        result,
        metadata,
        currentUser,
        isPlaywrightTest,
      };

      await this.courseService.publishCreateCourseEvent(course.id, metadata.language, currentUser);

      processingJobData = jobData;

      await this.enqueueScormImportJob(jobData);

      return result;
    } catch (error) {
      await this.cleanupSynchronousCourseImportFailure({
        stagedFileReference: queuedPackage.stagedFileReference,
        courseId,
        jobData: processingJobData,
      });

      throw error;
    }
  }

  async createLessonImport({
    scormPackage,
    metadata,
    currentUser,
  }: CreateScormLessonImportParams): Promise<ScormImportResult> {
    const { packageId, queuedPackage } = await this.stagePackageForImport(
      scormPackage,
      currentUser.tenantId,
    );

    let lessonId: UUIDType | undefined;
    let processingJobData: ScormImportJobData | undefined;

    try {
      const artifacts = this.preparePackageArtifacts(scormPackage, currentUser, packageId);

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
            language: metadata.language,
            currentUser,
          },
          trx,
        );

        return lesson;
      });

      lessonId = createdLesson.lessonId;

      const result = this.buildImportResult({
        id: createdLesson.lessonId,
        packageId: artifacts.packageId,
        scormPackage,
        scoCount: artifacts.manifest.scos.length,
      });

      const jobData = {
        action: SCORM_IMPORT_ACTION.CREATE_LESSON,
        packageId,
        scormPackage: queuedPackage,
        result,
        metadata,
        currentUser,
      };

      await this.adminLessonService.publishCreateLessonEvent(
        createdLesson.lessonId,
        createdLesson.language,
        currentUser,
      );

      processingJobData = jobData;

      await this.enqueueScormImportJob(jobData);

      return result;
    } catch (error) {
      await this.cleanupSynchronousLessonImportFailure({
        stagedFileReference: queuedPackage.stagedFileReference,
        lessonId,
        jobData: processingJobData,
        currentUser,
      });

      throw error;
    }
  }

  async attachLessonPackage({
    lessonId,
    scormPackage,
    metadata,
    currentUser,
  }: AttachScormLessonPackageParams): Promise<ScormImportResult> {
    const { packageId, queuedPackage } = await this.stagePackageForImport(
      scormPackage,
      currentUser.tenantId,
    );

    let packagePersisted = false;
    let processingJobData: ScormImportJobData | undefined;

    try {
      const existingPackage = await this.scormRepository.findLessonPackage({
        lessonId,
        language: metadata.language,
      });

      if (existingPackage) {
        throw new BadRequestException("adminScorm.errors.packageAlreadyAttached");
      }

      const artifacts = this.preparePackageArtifacts(scormPackage, currentUser, packageId);

      await this.adminLessonService.updateLesson(
        lessonId,
        {
          title: metadata.title,
          description: "",
          type: LESSON_TYPES.SCORM,
          language: metadata.language,
        },
        currentUser,
      );

      await this.db.transaction((trx) =>
        this.scormRepository.persistLessonPackage(
          {
            lessonId,
            packageId: artifacts.packageId,
            manifest: artifacts.manifest,
            originalFileReference: artifacts.originalFileReference,
            extractedFilesReference: artifacts.extractedFilesReference,
            manifestEntryPoint: artifacts.manifest.scos[0].launchPath,
            manifestReference: artifacts.manifestReference,
            language: metadata.language,
            currentUser,
          },
          trx,
        ),
      );

      packagePersisted = true;

      const result = this.buildImportResult({
        id: lessonId,
        packageId: artifacts.packageId,
        scormPackage,
        scoCount: artifacts.manifest.scos.length,
      });

      const jobData = {
        action: SCORM_IMPORT_ACTION.ATTACH_LESSON_PACKAGE,
        packageId,
        scormPackage: queuedPackage,
        result,
        lessonId,
        metadata,
        currentUser,
      };

      processingJobData = jobData;
      await this.enqueueScormImportJob(jobData);

      return result;
    } catch (error) {
      await this.cleanupSynchronousLessonImportFailure({
        stagedFileReference: queuedPackage.stagedFileReference,
        lessonId: packagePersisted ? lessonId : undefined,
        jobData: processingJobData,
        currentUser,
      });

      throw error;
    }
  }

  async processQueuedImportJob(
    jobData: ScormImportJobData | StreamedScormImportJobData,
  ): Promise<ScormImportResult> {
    if ("importRequest" in jobData) {
      return this.processStreamedQueuedImportJob(jobData);
    }

    let uploadedReferences: string[] = [];

    try {
      const buffer = await this.s3Service.getFileBuffer(jobData.scormPackage.stagedFileReference);

      const scormPackage = this.buildQueuedScormPackage(jobData.scormPackage, buffer);

      const artifacts = this.preparePackageArtifacts(
        scormPackage,
        jobData.currentUser,
        jobData.packageId,
      );

      uploadedReferences = await this.uploadPackageFiles(artifacts, jobData.currentUser.tenantId);

      await this.scormRepository.markPackageReady(jobData.packageId);

      this.publishScormImportStatus(jobData, SCORM_PACKAGE_STATUS.READY);

      return jobData.result!;
    } catch (error) {
      await this.deleteUploadedPackageFiles(uploadedReferences);

      throw error;
    } finally {
      await this.deleteUploadedPackageFiles([jobData.scormPackage.stagedFileReference]);
    }
  }

  private async processStreamedQueuedImportJob(
    jobData: StreamedScormImportJobData,
  ): Promise<ScormImportResult> {
    let uploadedReferences: string[] = [];
    let createdResult: ScormImportResult | undefined;

    try {
      const result =
        jobData.result ??
        (await this.persistStreamedImport(
          jobData,
          await this.prepareStreamedPackageArtifacts(jobData),
        ));
      createdResult = result;
      const uploadArtifacts = this.buildStreamedPackageUploadArtifacts(jobData, result.packageId);

      uploadedReferences = await this.uploadStreamedPackageFiles(
        uploadArtifacts,
        jobData.currentUser.tenantId,
      );

      await this.scormRepository.markPackageReady(jobData.packageId);

      this.publishScormImportStatus(
        {
          ...this.toLegacyNotificationJobData(jobData, result),
          result,
        },
        SCORM_PACKAGE_STATUS.READY,
      );

      return result;
    } catch (error) {
      await this.deleteUploadedPackageFiles(uploadedReferences);

      if (createdResult) {
        await this.deleteFailedQueuedImport(
          this.toLegacyNotificationJobData(jobData, createdResult),
        );
      }

      throw error;
    } finally {
      await this.deleteUploadedPackageFiles([jobData.scormPackage.stagedFileReference]);
    }
  }

  async handleQueuedImportFailure(jobData: AnyScormImportJobData) {
    try {
      if (!("importRequest" in jobData)) await this.deleteFailedQueuedImport(jobData);
    } finally {
      if ("importRequest" in jobData) {
        this.publishStreamedScormImportStatus(jobData, SCORM_PACKAGE_STATUS.FAILED);
      } else {
        this.publishScormImportStatus(jobData, SCORM_PACKAGE_STATUS.FAILED);
      }
    }
  }

  private buildImportResult(params: {
    id: UUIDType;
    packageId: UUIDType;
    scormPackage: Express.Multer.File | QueuedScormPackageFile;
    scoCount: number;
  }): ScormImportResult {
    return {
      id: params.id,
      packageId: params.packageId,
      fileName: params.scormPackage.originalname,
      fileSize: params.scormPackage.size,
      mimeType: params.scormPackage.mimetype,
      scoCount: params.scoCount,
    };
  }

  private buildStreamedImportJobData(
    session: ScormTusUploadState,
    currentUser: CurrentUserType,
  ): StreamedScormImportJobData {
    return {
      packageId: session.packageId,
      scormPackage: {
        stagedFileReference: session.stagedFileReference,
        originalname: session.filename,
        mimetype: session.mimeType,
        size: session.uploadLength,
      },
      currentUser,
      importRequest: session.importRequest,
    };
  }

  private async enqueueScormImportJob(jobData: AnyScormImportJobData) {
    if ("importRequest" in jobData) {
      this.publishStreamedScormImportStatus(jobData, SCORM_PACKAGE_STATUS.PROCESSING);
    } else {
      this.publishScormImportStatus(jobData, SCORM_PACKAGE_STATUS.PROCESSING);
    }

    await this.scormQueueService.enqueueImportJob(jobData);
  }

  private async cleanupSynchronousCourseImportFailure(params: {
    stagedFileReference: string;
    courseId?: UUIDType;
    jobData?: ScormImportJobData;
  }) {
    await this.deleteUploadedPackageFiles([params.stagedFileReference]);

    if (params.courseId) await this.scormRepository.deleteImportedCourse(params.courseId);

    if (params.jobData) this.publishScormImportStatus(params.jobData, SCORM_PACKAGE_STATUS.FAILED);
  }

  private async cleanupSynchronousLessonImportFailure(params: {
    stagedFileReference: string;
    lessonId?: UUIDType;
    jobData?: ScormImportJobData;
    currentUser: CurrentUserType;
  }) {
    await this.deleteUploadedPackageFiles([params.stagedFileReference]);

    if (params.lessonId) await this.removeImportedLesson(params.lessonId, params.currentUser);

    if (params.jobData) this.publishScormImportStatus(params.jobData, SCORM_PACKAGE_STATUS.FAILED);
  }

  private publishScormImportStatus(jobData: ScormImportJobData, status: ScormPackageStatus) {
    const resultIds = this.getScormImportResultIds(jobData.action, jobData.result);

    this.wsGateway.emitToUser(
      jobData.currentUser.userId,
      SCORM_IMPORT_SOCKET.EVENTS.STATUS_CHANGED,
      {
        action: jobData.action,
        status,
        ...resultIds,
        packageId: jobData.packageId,
        language: jobData.metadata.language,
        messageKey: this.getScormImportMessageKey(jobData, status),
      },
    );
  }

  private publishStreamedScormImportStatus(
    jobData: StreamedScormImportJobData,
    status: ScormPackageStatus,
    result?: ScormImportResult,
  ) {
    const action = jobData.importRequest.action;
    const messageKey = this.getStreamedScormImportMessageKey(action, status);
    const resultIds = this.getScormImportResultIds(action, result);

    this.wsGateway.emitToUser(
      jobData.currentUser.userId,
      SCORM_IMPORT_SOCKET.EVENTS.STATUS_CHANGED,
      {
        action,
        status,
        ...resultIds,
        packageId: jobData.packageId,
        language: jobData.importRequest.metadata.language,
        messageKey,
      },
    );
  }

  private getScormImportResultIds(
    action: InitScormImportBody["action"],
    result?: ScormImportResult,
  ) {
    switch (action) {
      case SCORM_IMPORT_ACTION.CREATE_COURSE:
        return { courseId: result?.id, lessonId: undefined };
      case SCORM_IMPORT_ACTION.CREATE_LESSON:
      case SCORM_IMPORT_ACTION.ATTACH_LESSON_PACKAGE:
        return { courseId: undefined, lessonId: result?.id };
    }
  }

  private getStreamedScormImportMessageKey(
    action: StreamedScormImportJobData["importRequest"]["action"],
    status: ScormPackageStatus,
  ) {
    if (status === SCORM_PACKAGE_STATUS.PROCESSING) {
      return SCORM_IMPORT_SOCKET.MESSAGE_KEYS.PROCESSING;
    }

    if (status === SCORM_PACKAGE_STATUS.READY) {
      return SCORM_IMPORT_SOCKET.MESSAGE_KEYS.READY;
    }

    if (action === SCORM_IMPORT_ACTION.CREATE_COURSE) {
      return SCORM_IMPORT_SOCKET.MESSAGE_KEYS.FAILED_COURSE;
    }

    return SCORM_IMPORT_SOCKET.MESSAGE_KEYS.FAILED_LESSON;
  }

  private toLegacyNotificationJobData(
    jobData: StreamedScormImportJobData,
    result: ScormImportResult,
  ): ScormImportJobData {
    if (jobData.importRequest.action === SCORM_IMPORT_ACTION.CREATE_COURSE) {
      return {
        action: SCORM_IMPORT_ACTION.CREATE_COURSE,
        packageId: jobData.packageId,
        scormPackage: jobData.scormPackage,
        result,
        metadata: jobData.importRequest.metadata,
        currentUser: jobData.currentUser,
        isPlaywrightTest: false,
      };
    }

    if (jobData.importRequest.action === SCORM_IMPORT_ACTION.CREATE_LESSON) {
      return {
        action: SCORM_IMPORT_ACTION.CREATE_LESSON,
        packageId: jobData.packageId,
        scormPackage: jobData.scormPackage,
        result,
        metadata: jobData.importRequest.metadata,
        currentUser: jobData.currentUser,
      };
    }

    return {
      action: SCORM_IMPORT_ACTION.ATTACH_LESSON_PACKAGE,
      packageId: jobData.packageId,
      scormPackage: jobData.scormPackage,
      result,
      lessonId: jobData.importRequest.lessonId,
      metadata: jobData.importRequest.metadata,
      currentUser: jobData.currentUser,
    };
  }

  private getScormImportMessageKey(jobData: ScormImportJobData, status: ScormPackageStatus) {
    if (status === SCORM_PACKAGE_STATUS.PROCESSING) {
      return SCORM_IMPORT_SOCKET.MESSAGE_KEYS.PROCESSING;
    }

    if (status === SCORM_PACKAGE_STATUS.READY) {
      return SCORM_IMPORT_SOCKET.MESSAGE_KEYS.READY;
    }

    if (jobData.action === SCORM_IMPORT_ACTION.CREATE_COURSE) {
      return SCORM_IMPORT_SOCKET.MESSAGE_KEYS.FAILED_COURSE;
    }

    return SCORM_IMPORT_SOCKET.MESSAGE_KEYS.FAILED_LESSON;
  }

  private async deleteFailedQueuedImport(jobData: ScormImportJobData) {
    if (!jobData.result) return;

    switch (jobData.action) {
      case SCORM_IMPORT_ACTION.CREATE_COURSE:
        await this.scormRepository.deleteImportedCourse(jobData.result.id);
        return;
      case SCORM_IMPORT_ACTION.CREATE_LESSON:
        await this.removeImportedLesson(jobData.result.id, jobData.currentUser);
        return;
      case SCORM_IMPORT_ACTION.ATTACH_LESSON_PACKAGE:
        await this.scormRepository.deleteLessonPackages(jobData.lessonId);
        return;
      default:
        throw new InternalServerErrorException("adminScorm.errors.unsupportedImportAction");
    }
  }

  private async removeImportedLesson(lessonId: UUIDType, currentUser: CurrentUserType) {
    try {
      await this.adminLessonService.removeLesson(lessonId, currentUser);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }

    await this.scormRepository.deleteLessonPackages(lessonId);
  }

  async launchRuntime({ lessonId, scoId, language, currentUser }: ScormRuntimeLaunchParams) {
    const launchableSco = await this.scormRepository.findLaunchableSco({
      lessonId,
      scoId,
      language,
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
    });
    const runtimeState = await this.scormRepository.findRuntimeState(attempt.id);
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

    const attemptContext = await this.scormRepository.findAttemptContext(body.attemptId);

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

    const existingRuntimeState = await this.scormRepository.findRuntimeState(body.attemptId);
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
      rawCmiJson: mergedCmiJson,
      ...normalizedRuntimeState,
    });

    const scoCompleted =
      normalizedRuntimeState.completionStatus === SCORM_COMPLETION_STATUS.COMPLETED;

    if (finish || scoCompleted) {
      await this.scormRepository.markAttemptCompleted(body.attemptId);
    }

    const lessonCompleted = await this.scormRepository.areAllLessonScosCompleted({
      studentId: currentUser.userId,
      packageId: body.packageId,
      lessonId: body.lessonId,
      completedStatuses: [SCORM_COMPLETION_STATUS.COMPLETED],
      excludedSuccessStatuses: [SCORM_SUCCESS_STATUS.FAILED],
    });

    const progressResult = lessonCompleted
      ? await this.studentLessonProgressService.markLessonAsCompleted({
          id: body.lessonId,
          studentId: currentUser.userId,
          userPermissions: currentUser.permissions,
          actor: currentUser,
          language: body.language ?? SUPPORTED_LANGUAGES.EN,
        })
      : await this.studentLessonProgressService.markLessonAsIncomplete({
          id: body.lessonId,
          studentId: currentUser.userId,
          userPermissions: currentUser.permissions,
          actor: currentUser,
          resetStarted:
            normalizedRuntimeState.completionStatus === SCORM_COMPLETION_STATUS.NOT_ATTEMPTED,
        });

    const navigation = await this.scormRepository.findScoNavigation({
      packageId: body.packageId,
      lessonId: body.lessonId,
      scoId: body.scoId,
    });

    return {
      lessonCompleted,
      messageKey: progressResult.messageKey,
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
    const scormPackage = await this.scormRepository.findPackageById(params.packageId);

    if (!scormPackage || scormPackage.status !== SCORM_PACKAGE_STATUS.READY) {
      throw new NotFoundException("adminScorm.errors.runtime.contentNotFound");
    }

    await this.assertPackageContentAccess(params.packageId, params.currentUser);

    const objectReference = this.buildExtractedObjectReference(
      scormPackage.extractedFilesReference,
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

  private async stagePackageForImport(
    scormPackage: Express.Multer.File,
    tenantId: UUIDType,
  ): Promise<{ packageId: UUIDType; queuedPackage: QueuedScormPackageFile }> {
    this.assertScormPackage(scormPackage);

    const packageId = randomUUID();

    const stagedFileReference = getScormStagedUploadReference(
      tenantId,
      packageId,
      scormPackage.originalname,
    );

    await this.s3Service.uploadFile(
      scormPackage.buffer,
      stagedFileReference,
      scormPackage.mimetype || "application/zip",
    );

    return {
      packageId,
      queuedPackage: {
        stagedFileReference,
        originalname: scormPackage.originalname,
        mimetype: scormPackage.mimetype,
        size: scormPackage.size,
      },
    };
  }

  private buildQueuedScormPackage(
    file: QueuedScormPackageFile,
    buffer: Buffer,
  ): Express.Multer.File {
    return {
      buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    } as Express.Multer.File;
  }

  private assertScormPackage(scormPackage: Express.Multer.File) {
    if (!scormPackage?.buffer?.length) {
      throw new BadRequestException("adminScorm.errors.packageRequired");
    }
  }

  private preparePackageArtifacts(
    scormPackage: Express.Multer.File,
    currentUser: CurrentUserType,
    packageId: UUIDType = randomUUID(),
  ): PreparedPackageArtifacts {
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

  private async prepareStreamedPackageArtifacts(
    jobData: StreamedScormImportJobData,
  ): Promise<PreparedStreamedPackageArtifacts> {
    const scan = await this.scanStreamedPackage(jobData.scormPackage.stagedFileReference);
    const parsedManifest = this.parseManifest(scan.manifestXml);
    const manifest = this.buildManifestModel(parsedManifest, scan.manifestEntryName);

    this.assertLaunchFilePathsExist(manifest, scan.filePaths);

    const originalFileReference = getScormOriginalFileReference(
      jobData.currentUser.tenantId,
      jobData.packageId,
      jobData.scormPackage.originalname,
    );
    const extractedFilesReference = getScormExtractedFilesReference(
      jobData.currentUser.tenantId,
      jobData.packageId,
    );
    const manifestReference = getScormManifestReference(
      jobData.currentUser.tenantId,
      jobData.packageId,
      manifest.manifestPath,
    );

    return {
      packageId: jobData.packageId,
      manifest,
      originalFileReference,
      extractedFilesReference,
      manifestReference,
      originalFile: jobData.scormPackage,
      filePaths: scan.filePaths,
    };
  }

  private buildStreamedPackageUploadArtifacts(
    jobData: StreamedScormImportJobData,
    packageId: UUIDType,
  ): StreamedPackageUploadArtifacts {
    return {
      packageId,
      originalFileReference: getScormOriginalFileReference(
        jobData.currentUser.tenantId,
        packageId,
        jobData.scormPackage.originalname,
      ),
      extractedFilesReference: getScormExtractedFilesReference(
        jobData.currentUser.tenantId,
        packageId,
      ),
      originalFile: jobData.scormPackage,
    };
  }

  private async scanStreamedPackage(stagedFileReference: string) {
    const filePaths = new Set<string>();
    let fileCount = 0;
    let totalUncompressedSize = 0;
    let manifestXml: string | undefined;
    let manifestEntryName: string | undefined;

    const directory = await this.openStreamedZipDirectory(stagedFileReference);

    for (const entry of directory.files) {
      if (entry.type === "Directory") continue;

      const normalizedPath = normalizeScormRelativePath(entry.path);
      filePaths.add(normalizedPath);
      fileCount += 1;
      totalUncompressedSize += entry.uncompressedSize ?? 0;

      if (fileCount > MAX_SCORM_EXTRACTED_FILE_COUNT) {
        throw new BadRequestException("adminScorm.errors.tooManyFiles");
      }

      if (totalUncompressedSize > MAX_SCORM_TOTAL_UNCOMPRESSED_SIZE_BYTES) {
        throw new BadRequestException("adminScorm.errors.packageTooLarge");
      }

      if (!manifestXml && path.posix.basename(normalizedPath.toLowerCase()) === "imsmanifest.xml") {
        manifestEntryName = normalizedPath;
        manifestXml = (await entry.buffer()).toString("utf-8");
      }
    }

    if (!fileCount) {
      throw new BadRequestException("adminScorm.errors.emptyPackage");
    }

    if (!manifestXml || !manifestEntryName) {
      throw new BadRequestException("adminScorm.errors.manifestMissing");
    }

    return { filePaths, manifestXml, manifestEntryName };
  }

  private getZipRangeStream(stagedFileReference: string, offset: number, length?: number) {
    const output = new PassThrough();
    const end = typeof length === "number" ? offset + length : "";
    const range = `bytes=${offset}-${end}`;

    this.s3Service
      .getFileStream(stagedFileReference, range)
      .then(({ stream }) => {
        stream.on("error", (error) => output.destroy(error));
        stream.pipe(output);
      })
      .catch((error) => output.destroy(error));

    return output;
  }

  private openStreamedZipDirectory(stagedFileReference: string) {
    return unzipper.Open.custom({
      size: () => this.s3Service.getFileSize(stagedFileReference),
      stream: (offset, length) => this.getZipRangeStream(stagedFileReference, offset, length),
    });
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

  private assertLaunchFilePathsExist(manifest: ParsedScormManifest, fileEntryPaths: Set<string>) {
    for (const sco of manifest.scos) {
      const launchPath = sco.href.split(/[?#]/)[0];
      if (!fileEntryPaths.has(launchPath)) {
        throw new BadRequestException("adminScorm.errors.launchFileMissing");
      }
    }
  }

  private async getZipEntryStream(stagedFileReference: string) {
    const { stream } = await this.s3Service.getFileStream(stagedFileReference);
    return stream.pipe(unzipper.Parse());
  }

  private async persistStreamedImport(
    jobData: StreamedScormImportJobData,
    artifacts: PreparedStreamedPackageArtifacts,
  ): Promise<ScormImportResult> {
    const { importRequest, currentUser } = jobData;

    if (importRequest.action === SCORM_IMPORT_ACTION.CREATE_COURSE) {
      let packageIds: UUIDType[] = [];
      const course = await this.db.transaction(async (trx) => {
        const createdCourse = await this.courseService.createCourseInTransaction(
          {
            ...importRequest.metadata,
            status: importRequest.metadata.status ?? "draft",
            isScorm: true,
          },
          currentUser,
          false,
          trx,
        );

        packageIds = await this.scormRepository.persistCoursePackage(
          {
            courseId: createdCourse.id,
            packageId: artifacts.packageId,
            metadata: importRequest.metadata,
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

      await this.courseService.publishCreateCourseEvent(
        course.id,
        importRequest.metadata.language,
        currentUser,
      );

      return this.buildImportResult({
        id: course.id,
        packageId: packageIds[0] ?? artifacts.packageId,
        scormPackage: jobData.scormPackage,
        scoCount: artifacts.manifest.scos.length,
      });
    }

    if (importRequest.action === SCORM_IMPORT_ACTION.CREATE_LESSON) {
      const createdLesson = await this.db.transaction(async (trx) => {
        const lesson = await this.adminLessonService.createLessonForChapterInTransaction(
          {
            chapterId: importRequest.metadata.chapterId,
            title: importRequest.metadata.title,
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
            language: importRequest.metadata.language,
            currentUser,
          },
          trx,
        );

        return lesson;
      });

      await this.adminLessonService.publishCreateLessonEvent(
        createdLesson.lessonId,
        createdLesson.language,
        currentUser,
      );

      return this.buildImportResult({
        id: createdLesson.lessonId,
        packageId: artifacts.packageId,
        scormPackage: jobData.scormPackage,
        scoCount: artifacts.manifest.scos.length,
      });
    }

    const existingPackage = await this.scormRepository.findLessonPackage({
      lessonId: importRequest.lessonId,
      language: importRequest.metadata.language,
    });

    if (existingPackage) {
      throw new BadRequestException("adminScorm.errors.packageAlreadyAttached");
    }

    await this.adminLessonService.updateLesson(
      importRequest.lessonId,
      {
        title: importRequest.metadata.title,
        description: "",
        type: LESSON_TYPES.SCORM,
        language: importRequest.metadata.language,
      },
      currentUser,
    );

    await this.db.transaction((trx) =>
      this.scormRepository.persistLessonPackage(
        {
          lessonId: importRequest.lessonId,
          packageId: artifacts.packageId,
          manifest: artifacts.manifest,
          originalFileReference: artifacts.originalFileReference,
          extractedFilesReference: artifacts.extractedFilesReference,
          manifestEntryPoint: artifacts.manifest.scos[0].launchPath,
          manifestReference: artifacts.manifestReference,
          language: importRequest.metadata.language,
          currentUser,
        },
        trx,
      ),
    );

    return this.buildImportResult({
      id: importRequest.lessonId,
      packageId: artifacts.packageId,
      scormPackage: jobData.scormPackage,
      scoCount: artifacts.manifest.scos.length,
    });
  }

  private async uploadStreamedPackageFiles(
    artifacts: StreamedPackageUploadArtifacts,
    tenantId: UUIDType,
  ) {
    const uploadedReferences: string[] = [];

    await this.s3Service.copyFile(
      artifacts.originalFile.stagedFileReference,
      artifacts.originalFileReference,
      artifacts.originalFile.mimetype || "application/zip",
    );
    uploadedReferences.push(artifacts.originalFileReference);

    const directory = await this.openStreamedZipDirectory(
      artifacts.originalFile.stagedFileReference,
    );
    const fileEntries = directory.files.filter((entry) => entry.type === "File");

    await this.uploadStreamedZipEntries({
      entries: fileEntries,
      uploadedReferences,
      tenantId,
      packageId: artifacts.packageId,
    });

    return uploadedReferences;
  }

  private async uploadStreamedZipEntries(params: {
    entries: UnzipperFile[];
    uploadedReferences: string[];
    tenantId: UUIDType;
    packageId: UUIDType;
  }) {
    let nextEntryIndex = 0;
    const workerCount = Math.min(
      SCORM_STREAMED_EXTRACTION_UPLOAD_CONCURRENCY,
      params.entries.length,
    );

    const uploadNextEntry = async () => {
      while (nextEntryIndex < params.entries.length) {
        const entry = params.entries[nextEntryIndex];
        nextEntryIndex += 1;

        const reference = getScormExtractedFileReference(
          params.tenantId,
          params.packageId,
          entry.path,
        );

        await this.s3Service.uploadFile(
          entry.stream() as Readable,
          reference,
          resolveScormContentTypeFromFilename(entry.path),
          entry.uncompressedSize,
        );
        params.uploadedReferences.push(reference);
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => uploadNextEntry()));
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
    if (!references.length) return;

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

  private buildExtractedObjectReference(extractedFilesReference: string, relativePath: string) {
    return `${extractedFilesReference}/${normalizeScormRelativePath(relativePath)}`;
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
      case SCORM_1_2_LESSON_STATUS.FAILED:
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
