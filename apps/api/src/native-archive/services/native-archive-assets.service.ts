import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { buffer } from "node:stream/consumers";

import { BadRequestException, Injectable } from "@nestjs/common";
import { ALLOWED_LESSON_IMAGE_FILE_TYPES, isAudioFile, RESOURCE_VISIBILITY } from "@repo/shared";
import { cloneDeepWith } from "lodash";
import sharp from "sharp";

import { processInBatches } from "src/common/utils/processInBatches";
import {
  ALLOWED_MIME_TYPES,
  EXTENSION_TO_MIME_TYPE_MAP,
  MAX_FILE_SIZE,
  RESOURCE_CATEGORIES,
} from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { FileGuard } from "src/file/guards/file.guard";
import {
  getImageVariantBase,
  getImageVariantKey,
  isImageQuality,
  isImageVariantReference,
} from "src/file/image-variants/image-variant.utils";
import { validateAudioFileAtPath } from "src/file/utils/validate-audio";
import { S3Service } from "src/s3/s3.service";

import { resolveImportedAssetContentType } from "../native-archive-content-type";
import {
  getNativeArchiveAssetKey,
  getNativeArchiveImportPrefix,
} from "../native-archive-storage-paths";
import { NATIVE_ARCHIVE_JOB_STAGES, NATIVE_ARCHIVE_LIMITS } from "../native-archive.constants";
import { nativeArchiveImageFilePipe } from "../pipes/native-archive-image-file.pipe";
import { SILENT_NATIVE_ARCHIVE_PROGRESS } from "../utils/native-archive-job-progress.utils";

import type {
  NativeArchiveAssetStagingContext,
  NativeArchiveAssetUpload,
  NativeArchiveImageAssetGroup,
} from "./native-archive-assets.types";
import type { NativeArchiveLearningPathAssetFields } from "../native-archive-learning-path.types";
import type {
  NativeArchiveAsset,
  NativeArchiveProgressReporter,
  NativeArchiveScormAssetDirectory,
  NativeArchiveStagedAssets,
  NativeArchiveValidatedCourseSnapshot,
  ParsedNativeArchive,
} from "../native-archive.types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { SourceSnapshot } from "src/course-transfer/types/course-transfer-graph.types";

@Injectable()
export class NativeArchiveAssetsService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly fileService: FileService,
  ) {}

  async stageArchiveAssets(
    archive: ParsedNativeArchive,
    actor: CurrentUserType,
    snapshots: NativeArchiveValidatedCourseSnapshot[],
    learningPath?: NativeArchiveLearningPathAssetFields,
    progress: NativeArchiveProgressReporter = SILENT_NATIVE_ARCHIVE_PROGRESS,
  ): Promise<NativeArchiveStagedAssets> {
    const context = this.createStagingContext(archive, actor, snapshots, learningPath, progress);
    progress.enterStage(NATIVE_ARCHIVE_JOB_STAGES.UPLOADING_FILES);

    try {
      await this.stageReferencedImages(context);
      await this.stageRemainingAssets(context);
    } catch (error) {
      await this.deleteStagedAssets(
        context.uploadedFileReferences,
        context.uploadedS3Keys,
        context.resourceIds,
      );

      throw error;
    }

    return this.createStagedAssetsResult(snapshots, context);
  }

  private createStagingContext(
    archive: ParsedNativeArchive,
    actor: CurrentUserType,
    snapshots: NativeArchiveValidatedCourseSnapshot[],
    learningPath: NativeArchiveLearningPathAssetFields | undefined,
    progress: NativeArchiveProgressReporter,
  ): NativeArchiveAssetStagingContext {
    if (archive.manifest.assets.length && !this.s3Service.isConfigured()) {
      throw new BadRequestException("nativeArchive.error.storageUnavailable");
    }

    const importPrefix = getNativeArchiveImportPrefix(actor.tenantId, randomUUID());
    const scormDirectories = this.createScormDirectories(snapshots, importPrefix);
    const assetReferences = new Set<string>();
    snapshots.forEach((snapshot) => this.collectCourseAssetReferences(snapshot, assetReferences));

    if (learningPath) this.collectLearningPathAssetReferences(learningPath, assetReferences);

    return {
      archive,
      actor,
      importPrefix,
      scormDirectories,
      referenceMap: new Map(
        scormDirectories.map((directory) => [directory.sourceReference, directory.targetReference]),
      ),
      uploadedResourceIdsByFileKey: new Map(),
      assetReferences,
      uploadedFileReferences: [],
      uploadedS3Keys: [],
      resourceIds: [],
      progress,
      uploadWork: { completed: 0, total: 0 },
    };
  }

  /** Counts planned uploads; the total grows as images and then files are planned. */
  private planUploadWork(context: NativeArchiveAssetStagingContext, uploadCount: number) {
    context.uploadWork.total += uploadCount;
  }

  private completeUploadWork(context: NativeArchiveAssetStagingContext) {
    context.uploadWork.completed += 1;
    context.progress.reportStageWork(
      NATIVE_ARCHIVE_JOB_STAGES.UPLOADING_FILES,
      context.uploadWork.completed,
      context.uploadWork.total,
    );
  }

  /** Uploads images a few at a time; each one is recorded as soon as it lands, so cleanup sees it. */
  private async stageReferencedImages(context: NativeArchiveAssetStagingContext): Promise<void> {
    const referencedImageGroups = this.groupImageAssetsByBase(context.archive).filter(
      ({ sourceBase, assets }) =>
        context.assetReferences.has(sourceBase) ||
        assets.some((asset) => context.assetReferences.has(asset.sourceReference)),
    );

    this.planUploadWork(context, referencedImageGroups.length);

    await processInBatches(
      referencedImageGroups,
      async ({ sourceBase, assets }) => {
        const sourceAsset = this.chooseImageSource(assets, sourceBase);
        const uploaded = await this.uploadImageResource(sourceAsset, sourceBase, context);
        this.completeUploadWork(context);
        if (!uploaded) return;

        context.uploadedFileReferences.push(uploaded.fileKey);
        context.resourceIds.push(uploaded.resourceId);
        context.uploadedResourceIdsByFileKey.set(uploaded.fileKey, uploaded.resourceId);
        context.referenceMap.set(sourceBase, uploaded.fileKey);
      },
      { batchSize: NATIVE_ARCHIVE_LIMITS.ASSET_UPLOAD_BATCH_SIZE },
    );
  }

  private groupImageAssetsByBase(archive: ParsedNativeArchive): NativeArchiveImageAssetGroup[] {
    const assetsByBase = new Map<string, NativeArchiveAsset[]>();
    for (const asset of archive.manifest.assets) {
      if (!this.isImageAssetCandidate(asset)) continue;
      const sourceBase = getImageVariantBase(asset.sourceReference);
      const assets = assetsByBase.get(sourceBase) ?? [];
      assets.push(asset);
      assetsByBase.set(sourceBase, assets);
    }

    return [...assetsByBase].map(([sourceBase, assets]) => ({ sourceBase, assets }));
  }

  private async uploadImageResource(
    asset: NativeArchiveAsset,
    sourceBase: string,
    context: NativeArchiveAssetStagingContext,
  ) {
    const file = await this.readValidatedImageFile(asset, sourceBase, context.archive);
    if (!this.isSupportedFileServiceImageMimeType(file.mimetype)) return undefined;

    return this.fileService.uploadResource({
      file,
      resource: RESOURCE_CATEGORIES.COURSE,
      folder: "native-archive",
      currentUser: context.actor,
      title: { en: file.originalname },
      options: { visibility: RESOURCE_VISIBILITY.PRIVATE },
    });
  }

  private async readValidatedImageFile(
    asset: NativeArchiveAsset,
    sourceBase: string,
    archive: ParsedNativeArchive,
  ): Promise<Express.Multer.File> {
    if (asset.byteLength > MAX_FILE_SIZE) {
      throw new BadRequestException("nativeArchive.error.invalidAssetReference");
    }

    const sourceBuffer = await buffer(archive.openAsset(asset.path));
    if (sourceBuffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException("nativeArchive.error.invalidAssetReference");
    }

    try {
      const { format } = await sharp(sourceBuffer).metadata();
      if (!format) throw new Error("Missing image format");

      const isSvg = format === "svg";

      const buffer = isSvg ? await sharp(sourceBuffer).png().toBuffer() : sourceBuffer;
      const mimetype = isSvg ? "image/png" : (await FileGuard.getFileType(buffer))?.mime;
      if (!mimetype) throw new Error("Unknown image type");

      const file = {
        buffer,
        mimetype,
        size: buffer.length,
        originalname: path.posix.basename(sourceBase),
      } as Express.Multer.File;

      await nativeArchiveImageFilePipe.transform(file);
      return file;
    } catch {
      throw new BadRequestException("nativeArchive.error.invalidAssetReference");
    }
  }

  /**
   * Maps every remaining referenced asset to its staged key, then uploads the distinct keys a few at
   * a time. Content-addressed files that an earlier import already stored are not uploaded again.
   */
  private async stageRemainingAssets(context: NativeArchiveAssetStagingContext): Promise<void> {
    const uploadsByTargetReference = new Map<string, NativeArchiveAssetUpload>();

    for (const asset of context.archive.manifest.assets) {
      const scormDirectory = context.scormDirectories.find((directory) =>
        asset.sourceReference.startsWith(`${directory.sourcePath}/`),
      );

      if (!this.isReferencedAsset(asset.sourceReference, context.assetReferences, scormDirectory)) {
        continue;
      }

      if (isImageVariantReference(asset.sourceReference)) {
        const sourceBase = getImageVariantBase(asset.sourceReference);

        if (context.referenceMap.has(sourceBase)) {
          context.referenceMap.set(
            asset.sourceReference,
            this.getImageVariantTargetReference(
              asset.sourceReference,
              context.importPrefix,
              context.referenceMap,
            ),
          );
          continue;
        }
      }

      if (
        this.isImageAssetCandidate(asset) &&
        context.referenceMap.has(getImageVariantBase(asset.sourceReference))
      ) {
        continue;
      }

      const targetReference = this.getTargetReference(asset, context, scormDirectory);
      context.referenceMap.set(asset.sourceReference, targetReference);

      if (uploadsByTargetReference.has(targetReference)) continue;

      uploadsByTargetReference.set(targetReference, {
        asset,
        targetReference,
        contentType: resolveImportedAssetContentType(asset, Boolean(scormDirectory)),
        isLessonFile: !scormDirectory,
        isContentAddressed: !scormDirectory && !isImageVariantReference(asset.sourceReference),
      });
    }

    this.planUploadWork(context, uploadsByTargetReference.size);

    await processInBatches(
      [...uploadsByTargetReference.values()],
      async (upload) => {
        await this.uploadStagedAsset(context, upload);
        this.completeUploadWork(context);
      },
      { batchSize: NATIVE_ARCHIVE_LIMITS.ASSET_UPLOAD_BATCH_SIZE },
    );
  }

  /**
   * Content-addressed files are never deleted when an import fails: another import may already
   * use the same verified file, and leaving it costs one copy per distinct file.
   */
  private async uploadStagedAsset(
    context: NativeArchiveAssetStagingContext,
    upload: NativeArchiveAssetUpload,
  ): Promise<void> {
    const { asset, targetReference } = upload;

    if (upload.isContentAddressed) {
      if (await this.s3Service.getFileExists(targetReference)) return;
    } else {
      context.uploadedS3Keys.push(targetReference);
    }

    const uploadContentType = upload.isLessonFile
      ? await this.resolveValidatedAudioContentType(asset, context.archive, upload.contentType)
      : upload.contentType;

    if (asset.byteLength === 0) {
      await this.s3Service.uploadFile(Buffer.alloc(0), targetReference, uploadContentType, 0);

      return;
    }

    await this.s3Service.uploadStreamMultipart(
      context.archive.openAsset(asset.path),
      targetReference,
      uploadContentType,
    );
  }

  private createStagedAssetsResult(
    snapshots: NativeArchiveValidatedCourseSnapshot[],
    context: NativeArchiveAssetStagingContext,
  ): NativeArchiveStagedAssets {
    const rewriteValue = <T>(value: T): T => this.rewriteReferences(value, context.referenceMap);

    return {
      snapshots: snapshots.map(rewriteValue),
      uploadedResourceIdsByFileKey: context.uploadedResourceIdsByFileKey,
      rewriteReference: (reference) =>
        reference ? (context.referenceMap.get(reference) ?? reference) : null,
      rewriteValue,
      deleteStaged: () =>
        this.deleteStagedAssets(
          context.uploadedFileReferences,
          context.uploadedS3Keys,
          context.resourceIds,
        ),
    };
  }

  private collectCourseAssetReferences(
    snapshot: NativeArchiveValidatedCourseSnapshot,
    references: Set<string>,
  ): void {
    const assetReferences = [
      snapshot.course.thumbnailS3Key,
      snapshot.course.authorMetadata?.profilePictureReference,
      snapshot.course.settings.certificateSignature,
      ...snapshot.lessons.map((lesson) => lesson.fileS3Key),
      ...snapshot.questions.map((question) => question.photoS3Key),
      ...snapshot.aiMentors.map((mentor) => mentor.avatarReference),
      ...snapshot.lessonContentResources.map((resource) => resource.reference),
      ...[
        ...snapshot.lessonResources,
        ...snapshot.questionResources,
        ...snapshot.courseResources,
      ].map(({ resource }) => resource.reference),
      ...snapshot.scormPackages.map((scormPackage) => scormPackage.originalFileReference),
      ...(snapshot.liveTrainingLessons ?? []).flatMap((record) =>
        record.materials.map((material) => material.resource.reference),
      ),
    ];

    for (const reference of assetReferences) {
      if (reference) references.add(reference);
    }
  }

  private collectLearningPathAssetReferences(
    learningPath: NativeArchiveLearningPathAssetFields,
    references: Set<string>,
  ): void {
    if (learningPath.thumbnailReference) references.add(learningPath.thumbnailReference);
    if (learningPath.settings.certificateSignature) {
      references.add(learningPath.settings.certificateSignature);
    }
  }

  private createScormDirectories(
    snapshots: SourceSnapshot[],
    importPrefix: string,
  ): NativeArchiveScormAssetDirectory[] {
    const sourcePrefixes = new Set(
      snapshots.flatMap((snapshot) =>
        snapshot.scormPackages.map((scormPackage) => scormPackage.extractedFilesReference),
      ),
    );

    return [...sourcePrefixes].map((sourceReference) => {
      const targetReference = `${importPrefix}/scorm/${this.hashReference(sourceReference)}`;

      return {
        sourceReference,
        sourcePath: sourceReference.replace(/\/+$/, ""),
        targetReference,
      };
    });
  }

  private getTargetReference(
    asset: NativeArchiveAsset,
    context: NativeArchiveAssetStagingContext,
    scormDirectory: NativeArchiveScormAssetDirectory | undefined,
  ): string {
    const { sourceReference } = asset;

    if (scormDirectory) {
      const relativePath = sourceReference.slice(scormDirectory.sourcePath.length + 1);

      return `${scormDirectory.targetReference}/${relativePath}`;
    }

    if (isImageVariantReference(sourceReference)) {
      return this.getImageVariantTargetReference(
        sourceReference,
        context.importPrefix,
        context.referenceMap,
      );
    }

    const extension = path.posix.extname(sourceReference.split("?")[0] ?? "").slice(0, 16);

    return getNativeArchiveAssetKey(
      context.actor.tenantId,
      this.hashReference(`${asset.sha256}:${sourceReference}`),
      extension,
    );
  }

  private isReferencedAsset(
    sourceReference: string,
    assetReferences: Set<string>,
    scormDirectory: NativeArchiveScormAssetDirectory | undefined,
  ): boolean {
    if (scormDirectory || assetReferences.has(sourceReference)) return true;

    return (
      isImageVariantReference(sourceReference) &&
      assetReferences.has(getImageVariantBase(sourceReference))
    );
  }

  private getImageVariantTargetReference(
    sourceReference: string,
    importPrefix: string,
    referenceMap: Map<string, string>,
  ): string {
    const sourceBase = getImageVariantBase(sourceReference);
    const targetBase =
      referenceMap.get(sourceBase) ??
      `${importPrefix}/variants/${this.hashReference(sourceBase)}.webp`;
    referenceMap.set(sourceBase, targetBase);

    const quality = sourceReference.match(/-(\d+w)\.webp$/)?.[1];

    if (!quality) return targetBase;

    if (isImageQuality(quality)) return getImageVariantKey(targetBase, quality);

    return `${targetBase.slice(0, -".webp".length)}-${quality}.webp`;
  }

  private chooseImageSource(
    candidates: NativeArchiveAsset[],
    sourceBase: string,
  ): NativeArchiveAsset {
    const original = candidates.find((asset) => asset.sourceReference === sourceBase);
    if (original) return original;

    return [...candidates].sort((left, right) => {
      const width = (reference: string) => Number(reference.match(/-(\d+)w\.webp$/)?.[1] ?? 0);

      return width(right.sourceReference) - width(left.sourceReference);
    })[0];
  }

  private isImageAssetCandidate(asset: NativeArchiveAsset): boolean {
    const extension = path.posix
      .extname(asset.sourceReference.split("?")[0] ?? "")
      .slice(1)
      .toLowerCase();
    const extensionMimeType = EXTENSION_TO_MIME_TYPE_MAP[extension];

    return (
      this.isSupportedFileServiceImageMimeType(asset.contentType) ||
      Boolean(extensionMimeType && this.isSupportedFileServiceImageMimeType(extensionMimeType))
    );
  }

  private isSupportedFileServiceImageMimeType(mimeType: string): boolean {
    return (
      mimeType.startsWith("image/") &&
      (ALLOWED_MIME_TYPES.some((allowed) => allowed === mimeType) ||
        ALLOWED_LESSON_IMAGE_FILE_TYPES.includes(mimeType))
    );
  }

  /** Imported lesson audio gets the same content validation as a direct upload. */
  private async resolveValidatedAudioContentType(
    asset: NativeArchiveAsset,
    archive: ParsedNativeArchive,
    contentType: string,
  ) {
    const isAudioAsset =
      asset.contentType.startsWith("audio/") ||
      isAudioFile({ type: asset.contentType, name: asset.sourceReference });

    if (!isAudioAsset) return contentType;

    return validateAudioFileAtPath(await archive.extractAsset(asset.path), {
      originalname: path.posix.basename(asset.sourceReference),
      mimetype: asset.contentType,
      size: asset.byteLength,
    });
  }

  private rewriteReferences<T>(value: T, referenceMap: ReadonlyMap<string, string>): T {
    return cloneDeepWith(value, (item) =>
      typeof item === "string" ? (referenceMap.get(item) ?? item) : undefined,
    );
  }

  /** Removes what this import staged; content-addressed files are kept, see uploadStagedAsset. */
  private async deleteStagedAssets(
    uploadedFileReferences: string[],
    uploadedS3Keys: string[],
    resourceIds: UUIDType[],
  ): Promise<void> {
    await Promise.all([
      processInBatches(
        uploadedFileReferences,
        (reference) => this.fileService.deleteFile(reference),
        {
          batchSize: NATIVE_ARCHIVE_LIMITS.ASSET_CLEANUP_BATCH_SIZE,
          throwOnError: false,
        },
      ),
      processInBatches(uploadedS3Keys, (key) => this.s3Service.deleteFile(key), {
        batchSize: NATIVE_ARCHIVE_LIMITS.ASSET_CLEANUP_BATCH_SIZE,
        throwOnError: false,
      }),
      this.fileService.archiveResources(resourceIds),
    ]);
  }

  private hashReference(reference: string): string {
    return createHash("sha256").update(reference).digest("hex");
  }
}
