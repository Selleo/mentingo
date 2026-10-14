import { createHash } from "crypto";
import path from "path";

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ENTITY_TYPES } from "@repo/shared";
import { match } from "ts-pattern";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { processInBatches } from "src/common/utils/processInBatches";
import {
  COURSE_TRANSFER_MODES,
  COURSE_TRANSFER_RESOURCE_GROUPS,
  COURSE_TRANSFER_RESOURCE_REFERENCE_KINDS,
  COURSE_TRANSFER_SCORM_COPY_BATCH_SIZE,
} from "src/course-transfer/course-transfer.constants";
import { CourseTransferGraphRepository } from "src/course-transfer/repositories/course-transfer-graph.repository";
import {
  buildInternalResourceFieldKey,
  getAllResourceReferences,
  getTargetScormStorage,
  normalizeCourseSettings,
  rewriteScormStorageReference,
  shouldSyncLesson,
} from "src/course-transfer/utils/course-transfer-graph.utils";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { HostedVideoCopyService } from "src/file/hosted-video-copy.service";
import { IMAGE_VARIANT_CONTENT_TYPE } from "src/file/image-variants/image-variant.constants";
import { isImageVariantReference } from "src/file/image-variants/image-variant.utils";
import { prefixTenantStorageKey } from "src/file/utils/tenantStorageKey";
import {
  extractResourceIdsFromRichText,
  getLocalizedRichTextEntries,
} from "src/resource-library/resource-library.utils";
import { S3Service } from "src/s3/s3.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { normalizeJsonb } from "src/utils/jsonb";

import type { UUIDType } from "src/common";
import type {
  CourseTransferPrepareCourseInput,
  CourseTransferPreparedCourse,
  CourseTransferPreparedScormPackage,
  AddExternalResourceReferenceParams,
  AddInternalResourceReferenceParams,
  BuildCopiedResourceReferenceParams,
  CopyScormPackageStorageParams,
  CopySourceResourceReferencesParams,
  CopyVideoReferenceParams,
  CourseTransferCopySourceReference,
  CourseTransferResourceCollection,
  ResolveTargetResourceReferenceParams,
  SourceSnapshot,
} from "src/course-transfer/types/course-transfer-graph.types";
import type { Readable } from "stream";

@Injectable()
export class CourseTransferAssetService {
  constructor(
    private readonly courseTransferGraphRepository: CourseTransferGraphRepository,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly s3Service: S3Service,
    private readonly bunnyStreamService: BunnyStreamService,
    private readonly hostedVideoCopyService: HostedVideoCopyService,
  ) {}

  /**
   * Validates where every referenced asset comes from and copies it into destination storage.
   * Runs before the destination transaction so provider work never holds database locks.
   */
  async prepareCourse(
    input: CourseTransferPrepareCourseInput,
  ): Promise<CourseTransferPreparedCourse> {
    const { snapshot, sourceTenantId, destination, policy } = input;

    const errors = match(policy.mode)
      .with(COURSE_TRANSFER_MODES.SYNC, () => ({
        source: "masterCourse.error.sourceTenantMissing",
        destination: "masterCourse.error.targetTenantMissing",
      }))
      .with(COURSE_TRANSFER_MODES.DUPLICATE, () => ({
        source: "courseDuplication.error.tenantMissing",
        destination: "courseDuplication.error.tenantMissing",
      }))
      .exhaustive();

    const destinationHost = await this.courseTransferGraphRepository.getTenantHost(
      destination.tenantId,
    );
    const sourceHost = await this.courseTransferGraphRepository.getTenantHost(sourceTenantId);
    if (!destinationHost) throw new NotFoundException(errors.destination);
    if (!sourceHost) throw new NotFoundException(errors.source);

    const resourceCollection = this.buildSourceResourceCollection(snapshot);

    await this.copySourceResourceReferences(resourceCollection, {
      targetCourseId: destination.courseId,
      sourceTenantId,
      sourceTenantOrigin: sourceHost,
      targetTenantId: destination.tenantId,
      uploadedResourceIdsByFileKey:
        policy.mode === COURSE_TRANSFER_MODES.DUPLICATE
          ? policy.uploadedResourceIdsByFileKey
          : undefined,
    });

    const scormScopeId = match(policy)
      .with({ mode: COURSE_TRANSFER_MODES.SYNC }, ({ exportId }) => exportId)
      .with({ mode: COURSE_TRANSFER_MODES.DUPLICATE }, () => destination.courseId)
      .exhaustive();
    const scormPackages = await this.prepareScormPackages(
      snapshot,
      destination.tenantId,
      scormScopeId,
    );

    return {
      snapshot,
      resourceCollection,
      scormPackages,
      source: { tenantId: sourceTenantId, host: sourceHost },
      destination: { ...destination, host: destinationHost },
    };
  }

  private async prepareScormPackages(
    snapshot: SourceSnapshot,
    targetTenantId: UUIDType,
    scopeId: UUIDType,
  ): Promise<CourseTransferPreparedScormPackage[]> {
    const preparedPackages: CourseTransferPreparedScormPackage[] = [];

    for (const sourcePackage of snapshot.scormPackages) {
      const target = getTargetScormStorage(scopeId, targetTenantId, sourcePackage);
      await this.copyScormPackageStorage({
        sourceOriginalFileReference: sourcePackage.originalFileReference,
        sourceExtractedFilesReference: sourcePackage.extractedFilesReference,
        ...target,
      });
      preparedPackages.push({ sourcePackage, ...target });
    }

    return preparedPackages;
  }

  private buildSourceResourceCollection(
    sourceSnapshot: SourceSnapshot,
  ): CourseTransferResourceCollection {
    const collection: CourseTransferResourceCollection = {
      [COURSE_TRANSFER_RESOURCE_GROUPS.COURSES]: { external: {}, internal: {} },
      [COURSE_TRANSFER_RESOURCE_GROUPS.CHAPTERS]: { external: {}, internal: {} },
      [COURSE_TRANSFER_RESOURCE_GROUPS.LESSONS]: { external: {}, internal: {} },
      [COURSE_TRANSFER_RESOURCE_GROUPS.QUESTIONS]: { external: {}, internal: {} },
    };

    this.addInternalResourceReference(collection, {
      group: COURSE_TRANSFER_RESOURCE_GROUPS.COURSES,
      sourceEntityType: ENTITY_TYPES.COURSE,
      sourceEntityId: sourceSnapshot.course.id,
      fieldPath: "thumbnailS3Key",
      reference: sourceSnapshot.course.thumbnailS3Key,
    });

    const courseSettings = normalizeCourseSettings(sourceSnapshot.course.settings);

    this.addInternalResourceReference(collection, {
      group: COURSE_TRANSFER_RESOURCE_GROUPS.COURSES,
      sourceEntityType: ENTITY_TYPES.COURSE,
      sourceEntityId: sourceSnapshot.course.id,
      fieldPath: "settings.certificateSignature",
      reference: courseSettings.certificateSignature,
    });

    for (const { resource, relation } of sourceSnapshot.courseResources) {
      this.addExternalResourceReference(collection, {
        group: COURSE_TRANSFER_RESOURCE_GROUPS.COURSES,
        sourceEntityType: ENTITY_TYPES.COURSE,
        sourceEntityId: relation.entityId,
        relationshipType: relation.relationshipType,
        resource,
        relation,
      });
    }

    const syncedLessonIds = new Set(
      sourceSnapshot.lessons
        .filter((sourceLesson) => shouldSyncLesson(sourceLesson))
        .map((sourceLesson) => sourceLesson.id),
    );

    for (const sourceLesson of sourceSnapshot.lessons) {
      if (!syncedLessonIds.has(sourceLesson.id)) continue;

      this.addInternalResourceReference(collection, {
        group: COURSE_TRANSFER_RESOURCE_GROUPS.LESSONS,
        sourceEntityType: ENTITY_TYPES.LESSON,
        sourceEntityId: sourceLesson.id,
        fieldPath: "fileS3Key",
        reference: sourceLesson.fileS3Key,
        ...this.getLessonFileReferenceMetadata(sourceLesson),
      });
    }

    for (const { resource, relation } of sourceSnapshot.lessonResources) {
      if (!syncedLessonIds.has(relation.entityId)) continue;

      this.addExternalResourceReference(collection, {
        group: COURSE_TRANSFER_RESOURCE_GROUPS.LESSONS,
        sourceEntityType: ENTITY_TYPES.LESSON,
        sourceEntityId: relation.entityId,
        relationshipType: relation.relationshipType,
        resource,
        relation,
      });
    }

    const lessonContentResourceById = new Map(
      sourceSnapshot.lessonContentResources.map((resource) => [resource.id, resource]),
    );

    for (const sourceLesson of sourceSnapshot.lessons) {
      if (!syncedLessonIds.has(sourceLesson.id)) continue;

      for (const resourceId of this.extractLocalizedRichTextResourceIds(sourceLesson.description)) {
        const resource = lessonContentResourceById.get(resourceId);
        if (!resource) continue;

        this.addExternalResourceReference(collection, {
          group: COURSE_TRANSFER_RESOURCE_GROUPS.LESSONS,
          sourceEntityType: ENTITY_TYPES.LESSON,
          sourceEntityId: sourceLesson.id,
          relationshipType: RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
          resource,
        });
      }
    }

    for (const sourceAiMentor of sourceSnapshot.aiMentors) {
      if (!syncedLessonIds.has(sourceAiMentor.lessonId)) continue;

      this.addInternalResourceReference(collection, {
        group: COURSE_TRANSFER_RESOURCE_GROUPS.LESSONS,
        sourceEntityType: ENTITY_TYPES.LESSON,
        sourceEntityId: sourceAiMentor.lessonId,
        fieldPath: "aiMentorLessons.avatarReference",
        reference: sourceAiMentor.avatarReference,
      });
    }

    for (const { resource, relation } of sourceSnapshot.questionResources) {
      this.addExternalResourceReference(collection, {
        group: COURSE_TRANSFER_RESOURCE_GROUPS.QUESTIONS,
        sourceEntityType: ENTITY_TYPES.ASSESSMENT_QUESTION,
        sourceEntityId: relation.entityId,
        relationshipType: relation.relationshipType,
        resource,
        relation,
      });
    }

    for (const sourceQuestion of sourceSnapshot.questions) {
      this.addInternalResourceReference(collection, {
        group: COURSE_TRANSFER_RESOURCE_GROUPS.QUESTIONS,
        sourceEntityType: ENTITY_TYPES.QUESTION,
        sourceEntityId: sourceQuestion.id,
        fieldPath: "photoS3Key",
        reference: sourceQuestion.photoS3Key,
      });
    }

    return collection;
  }

  private addExternalResourceReference(
    collection: CourseTransferResourceCollection,
    params: AddExternalResourceReferenceParams,
  ) {
    const sourceReference = this.normalizeResourceReference(params.resource.reference);
    if (!sourceReference) return;

    const relationKey = [
      params.sourceEntityType,
      params.sourceEntityId,
      params.relationshipType,
      params.resource.id,
    ].join(":");

    collection[params.group].external[relationKey] = {
      kind: COURSE_TRANSFER_RESOURCE_REFERENCE_KINDS.EXTERNAL,
      group: params.group,
      source: {
        entityType: params.sourceEntityType,
        entityId: params.sourceEntityId,
        reference: sourceReference,
        contentType: params.resource.contentType,
        filename: this.getResourceOriginalFilename(params.resource),
        isVideo: this.isVideoResource(params.resource.reference, params.resource.contentType),
        resourceId: params.resource.id,
        relationshipType: params.relationshipType,
        resource: params.resource,
        relation: params.relation,
      },
      target: {
        entityId: null,
        reference: null,
        resourceId: null,
        relationshipType: params.relationshipType,
      },
    };
  }

  private extractLocalizedRichTextResourceIds(value: unknown) {
    return [
      ...new Set(
        getLocalizedRichTextEntries(value).flatMap(([, content]) =>
          extractResourceIdsFromRichText(content),
        ),
      ),
    ];
  }

  private addInternalResourceReference(
    collection: CourseTransferResourceCollection,
    params: AddInternalResourceReferenceParams,
  ) {
    const sourceReference = this.normalizeResourceReference(params.reference);
    if (!sourceReference) return;

    const fieldKey = buildInternalResourceFieldKey(
      params.sourceEntityType,
      params.sourceEntityId,
      params.fieldPath,
    );

    collection[params.group].internal[fieldKey] = {
      kind: COURSE_TRANSFER_RESOURCE_REFERENCE_KINDS.INTERNAL,
      group: params.group,
      source: {
        entityType: params.sourceEntityType,
        entityId: params.sourceEntityId,
        reference: sourceReference,
        contentType: params.contentType,
        filename: params.filename,
        isVideo: params.isVideo,
        fieldPath: params.fieldPath,
      },
      target: {
        entityId: null,
        reference: null,
      },
    };
  }

  private normalizeResourceReference(reference: unknown): string | null {
    if (typeof reference !== "string") return null;

    const trimmedReference = reference.trim();
    return trimmedReference.length ? trimmedReference : null;
  }

  private getLessonFileReferenceMetadata(sourceLesson: SourceSnapshot["lessons"][number]) {
    const contentType = this.getLessonFileContentType(sourceLesson);

    return {
      contentType,
      filename: this.getReferenceFilename(sourceLesson.fileS3Key),
      isVideo: this.isVideoResource(sourceLesson.fileS3Key, contentType),
    };
  }

  private getLessonFileContentType(sourceLesson: SourceSnapshot["lessons"][number]) {
    if (sourceLesson.fileS3Key?.startsWith("bunny-")) return "video/mp4";
    if (sourceLesson.fileType?.startsWith("video/")) return sourceLesson.fileType;

    return (
      this.getVideoContentTypeFromExtension(sourceLesson.fileType) ??
      this.getVideoContentTypeFromExtension(sourceLesson.fileS3Key)
    );
  }

  private getVideoContentTypeFromExtension(value: string | null | undefined) {
    if (!value) return undefined;

    const normalizedExtension = value.includes(".")
      ? path.extname(value).replace(".", "").toLowerCase()
      : value.replace(".", "").toLowerCase();

    const contentTypeByExtension: Record<string, string> = {
      mp4: "video/mp4",
      mov: "video/quicktime",
      webm: "video/webm",
      ogg: "video/ogg",
      avi: "video/avi",
      wmv: "video/wmv",
    };

    return contentTypeByExtension[normalizedExtension];
  }

  private isVideoResource(reference: string | null | undefined, contentType?: string | null) {
    return (
      Boolean(reference?.startsWith("bunny-")) ||
      Boolean(contentType?.startsWith("video/")) ||
      Boolean(this.getVideoContentTypeFromExtension(reference))
    );
  }

  private getResourceOriginalFilename(
    resource: SourceSnapshot["courseResources"][number]["resource"],
  ) {
    const metadata = normalizeJsonb<Record<string, unknown>>(resource.metadata, {});
    const originalFilename = metadata.originalFilename;

    return typeof originalFilename === "string"
      ? originalFilename
      : this.getReferenceFilename(resource.reference);
  }

  private getReferenceFilename(reference: string | null | undefined) {
    if (!reference) return null;
    if (reference.startsWith("bunny-")) return `${reference.replace("bunny-", "")}.mp4`;

    return path.basename(reference.split("?")[0] ?? reference) || null;
  }

  private async copySourceResourceReferences(
    collection: CourseTransferResourceCollection,
    params: CopySourceResourceReferencesParams,
  ) {
    const copiedReferences = new Map<string, string>();
    const targetBunnyConfigured = await this.tenantDbRunnerService.runWithTenant(
      params.targetTenantId,
      () => this.bunnyStreamService.isConfigured(),
    );
    const sourceAndTargetShareBunnyMediaConfiguration = targetBunnyConfigured
      ? await this.sourceAndTargetShareBunnyMediaConfiguration(
          params.sourceTenantId,
          params.targetTenantId,
        )
      : false;

    for (const resourceReference of getAllResourceReferences(collection)) {
      const targetReference = await this.resolveTargetResourceReference(resourceReference.source, {
        targetCourseId: params.targetCourseId,
        sourceTenantId: params.sourceTenantId,
        sourceTenantOrigin: params.sourceTenantOrigin,
        targetTenantId: params.targetTenantId,
        targetBunnyConfigured,
        sourceAndTargetShareBunnyMediaConfiguration,
        copiedReferences,
        uploadedResourceIdsByFileKey: params.uploadedResourceIdsByFileKey,
      });

      resourceReference.target.reference = targetReference;
    }
  }

  private async resolveTargetResourceReference(
    source: CourseTransferCopySourceReference,
    params: ResolveTargetResourceReferenceParams,
  ) {
    if (params.uploadedResourceIdsByFileKey?.has(source.reference)) return source.reference;

    const existingTargetReference = params.copiedReferences.get(source.reference);
    if (existingTargetReference) return existingTargetReference;

    if (this.isVideoReference(source)) {
      const targetReference = await this.copyVideoReference(source, params);
      params.copiedReferences.set(source.reference, targetReference);
      return targetReference;
    }

    if (!this.isCopyableS3Reference(source.reference)) return source.reference;

    const targetReference = this.buildCopiedResourceReference(source.reference, {
      targetCourseId: params.targetCourseId,
      targetTenantId: params.targetTenantId,
    });

    if (isImageVariantReference(source.reference)) {
      await this.copyImageVariantReference(source.reference, targetReference);
      params.copiedReferences.set(source.reference, targetReference);
      return targetReference;
    }

    if (await this.s3Service.getFileExists(targetReference)) {
      params.copiedReferences.set(source.reference, targetReference);
      return targetReference;
    }

    if (!(await this.s3Service.getFileExists(source.reference))) {
      return source.reference;
    }

    await this.s3Service.copyFile(
      source.reference,
      targetReference,
      source.contentType ?? undefined,
    );
    params.copiedReferences.set(source.reference, targetReference);

    return targetReference;
  }

  private async copyImageVariantReference(sourceReference: string, targetReference: string) {
    const sourceExtension = path.extname(sourceReference);
    const sourceStem = sourceExtension
      ? sourceReference.slice(0, -sourceExtension.length)
      : sourceReference;

    const targetExtension = path.extname(targetReference);
    const targetStem = targetExtension
      ? targetReference.slice(0, -targetExtension.length)
      : targetReference;

    const sourcePrefix = `${sourceStem}-`;
    const sourceKeys = await this.s3Service.listFileKeysByPrefix(sourcePrefix);

    await Promise.all(
      sourceKeys.map(async (sourceKey) => {
        if (!sourceKey.startsWith(sourcePrefix)) return;

        const variantSuffix = sourceKey.slice(sourceStem.length);
        if (!variantSuffix) return;

        const targetKey = `${targetStem}${variantSuffix}`;
        if (await this.s3Service.getFileExists(targetKey)) return;

        await this.s3Service.copyFile(sourceKey, targetKey, IMAGE_VARIANT_CONTENT_TYPE);
      }),
    );
  }

  private async copyVideoReference(
    source: CourseTransferCopySourceReference,
    params: CopyVideoReferenceParams,
  ) {
    if (source.reference.startsWith("http://") || source.reference.startsWith("https://")) {
      return source.reference;
    }

    if (
      params.targetBunnyConfigured &&
      params.sourceAndTargetShareBunnyMediaConfiguration &&
      source.reference.startsWith("bunny-")
    ) {
      return source.reference;
    }

    if (params.targetBunnyConfigured) {
      return this.hostedVideoCopyService.copyVideoToTenantLibrary({
        sourceTenantId: params.sourceTenantId,
        sourceReference: source.reference,
        targetTenantId: params.targetTenantId,
        title: source.filename ?? "Master course video",
        openSourceVideo: () =>
          this.openSourceVideoStream(source, params.sourceTenantId, params.sourceTenantOrigin),
      });
    }

    if (!this.s3Service.isConfigured()) {
      throw new BadRequestException("masterCourse.error.videoStorageNotConfigured");
    }

    if (this.isCopyableS3Reference(source.reference)) {
      const targetReference = this.buildCopiedResourceReference(source.reference, {
        targetCourseId: params.targetCourseId,
        targetTenantId: params.targetTenantId,
      });

      if (await this.s3Service.getFileExists(targetReference)) return targetReference;

      if (!(await this.s3Service.getFileExists(source.reference))) {
        throw new BadRequestException("masterCourse.error.sourceVideoMissing");
      }

      await this.s3Service.copyFile(
        source.reference,
        targetReference,
        source.contentType ?? "video/mp4",
      );
      return targetReference;
    }

    const targetReference = this.buildCopiedResourceReference(source.reference, {
      targetCourseId: params.targetCourseId,
      targetTenantId: params.targetTenantId,
      fallbackExtension: ".mp4",
    });

    if (await this.s3Service.getFileExists(targetReference)) return targetReference;

    const sourceVideo = await this.openSourceVideoStream(
      source,
      params.sourceTenantId,
      params.sourceTenantOrigin,
    );
    try {
      await this.s3Service.uploadStreamMultipart(
        sourceVideo.stream,
        targetReference,
        sourceVideo.contentType ?? "video/mp4",
      );
    } finally {
      sourceVideo.stream.destroy();
    }

    return targetReference;
  }

  private async openSourceVideoStream(
    source: CourseTransferCopySourceReference,
    sourceTenantId: UUIDType,
    sourceTenantOrigin: string,
  ): Promise<{ stream: Readable; contentType: string; filename: string }> {
    if (source.reference.startsWith("bunny-")) {
      const videoId = source.reference.replace("bunny-", "");
      return this.tenantDbRunnerService.runWithTenant(sourceTenantId, async () => {
        const video = await this.bunnyStreamService.downloadMp4Fallback(
          videoId,
          720,
          sourceTenantOrigin,
        );

        return {
          stream: video.stream,
          contentType: video.contentType,
          filename: source.filename ?? video.filename,
        };
      });
    }

    const file = await this.s3Service.getFileStream(source.reference);

    return {
      stream: file.stream,
      contentType: source.contentType ?? file.contentType ?? "video/mp4",
      filename: source.filename ?? this.getReferenceFilename(source.reference) ?? "video.mp4",
    };
  }

  private async sourceAndTargetShareBunnyMediaConfiguration(
    sourceTenantId: UUIDType,
    targetTenantId: UUIDType,
  ) {
    try {
      const [sourceSignature, targetSignature] = await Promise.all([
        this.tenantDbRunnerService.runWithTenant(sourceTenantId, () =>
          this.bunnyStreamService.getMediaConfigurationSignature(),
        ),
        this.tenantDbRunnerService.runWithTenant(targetTenantId, () =>
          this.bunnyStreamService.getMediaConfigurationSignature(),
        ),
      ]);

      return sourceSignature === targetSignature;
    } catch {
      return false;
    }
  }

  private isVideoReference(source: CourseTransferCopySourceReference) {
    return Boolean(source.isVideo) || this.isVideoResource(source.reference, source.contentType);
  }

  private isCopyableS3Reference(reference: string) {
    return (
      !reference.startsWith("http://") &&
      !reference.startsWith("https://") &&
      !reference.startsWith("bunny-")
    );
  }

  private buildCopiedResourceReference(
    sourceReference: string,
    params: BuildCopiedResourceReferenceParams,
  ) {
    const extension =
      path.extname(sourceReference.split("?")[0] ?? "") || params.fallbackExtension || "";
    const sourceHash = createHash("sha256").update(sourceReference).digest("hex").slice(0, 32);
    const targetDirectory = isImageVariantReference(sourceReference)
      ? `master-course/${params.targetCourseId}/variants`
      : `master-course/${params.targetCourseId}`;

    return prefixTenantStorageKey(
      `${targetDirectory}/${sourceHash}${extension}`,
      params.targetTenantId,
    );
  }

  private async copyScormPackageStorage(params: CopyScormPackageStorageParams) {
    await this.s3Service.copyFile(
      params.sourceOriginalFileReference,
      params.targetOriginalFileReference,
      "application/zip",
    );

    const sourceExtractedFileReferences = await this.s3Service.listFileKeysByPrefix(
      params.sourceExtractedFilesReference,
    );

    await processInBatches(
      sourceExtractedFileReferences,
      (sourceReference) =>
        this.s3Service.copyFile(
          sourceReference,
          rewriteScormStorageReference(
            sourceReference,
            params.sourceExtractedFilesReference,
            params.targetExtractedFilesReference,
          ),
        ),
      { batchSize: COURSE_TRANSFER_SCORM_COPY_BATCH_SIZE },
    );
  }
}
