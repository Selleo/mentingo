import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { BadRequestException, Injectable } from "@nestjs/common";
import { ALLOWED_LESSON_IMAGE_FILE_TYPES, RESOURCE_VISIBILITY } from "@repo/shared";
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
import { S3Service } from "src/s3/s3.service";

import { NATIVE_ARCHIVE_LIMITS } from "../native-archive.constants";
import { nativeArchiveImageFilePipe } from "../pipes/native-archive-image-file.pipe";

import type {
  NativeArchiveAssetStagingContext,
  NativeArchiveImageAssetGroup,
} from "./native-archive-assets.types";
import type { NativeArchiveLearningPathAssetFields } from "../native-archive-learning-path.types";
import type {
  NativeArchiveAsset,
  NativeArchiveScormAssetDirectory,
  NativeArchiveStagedAssets,
  NativeArchiveValidatedCourseSnapshot,
  ParsedNativeArchive,
} from "../native-archive.types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { SourceSnapshot } from "src/courses/types/master-course.types";

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
  ): Promise<NativeArchiveStagedAssets> {
    const context = this.createStagingContext(archive, actor, snapshots, learningPath);

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
    learningPath?: NativeArchiveLearningPathAssetFields,
  ): NativeArchiveAssetStagingContext {
    if (archive.manifest.assets.length && !this.s3Service.isConfigured()) {
      throw new BadRequestException("nativeArchive.error.storageUnavailable");
    }

    const importPrefix = `native-archive/${actor.tenantId}/${randomUUID()}`;
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
      assetReferences,
      uploadedFileReferences: [],
      uploadedS3Keys: [],
      resourceIds: [],
    };
  }

  private async stageReferencedImages(context: NativeArchiveAssetStagingContext): Promise<void> {
    for (const { sourceBase, assets } of this.groupImageAssetsByBase(context.archive)) {
      const isReferenced =
        context.assetReferences.has(sourceBase) ||
        assets.some((asset) => context.assetReferences.has(asset.sourceReference));
      if (!isReferenced) continue;

      const sourceAsset = this.chooseImageSource(assets, sourceBase);
      const uploaded = await this.uploadImageResource(sourceAsset, sourceBase, context);
      if (!uploaded) continue;

      context.uploadedFileReferences.push(uploaded.fileKey);
      context.resourceIds.push(uploaded.resourceId);
      context.referenceMap.set(sourceBase, uploaded.fileKey);
    }
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

    const filePath = archive.assetFiles.get(asset.path);
    if (!filePath) throw new BadRequestException("nativeArchive.error.missingAsset");

    const buffer = await readFile(filePath);
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException("nativeArchive.error.invalidAssetReference");
    }

    try {
      const { format } = await sharp(buffer).metadata();
      if (!format) throw new Error("Missing image format");

      const mimetype =
        (await FileGuard.getFileType(buffer))?.mime ?? (format === "svg" ? "image/svg+xml" : "");

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

  private async stageRemainingAssets(context: NativeArchiveAssetStagingContext): Promise<void> {
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

      const targetReference = this.getTargetReference(
        asset.sourceReference,
        context.importPrefix,
        scormDirectory,
        context.referenceMap,
      );
      context.uploadedS3Keys.push(targetReference);

      await this.uploadAsset(context.archive, asset, targetReference);
      context.referenceMap.set(asset.sourceReference, targetReference);
    }
  }

  private createStagedAssetsResult(
    snapshots: NativeArchiveValidatedCourseSnapshot[],
    context: NativeArchiveAssetStagingContext,
  ): NativeArchiveStagedAssets {
    const rewriteValue = <T>(value: T): T => this.rewriteReferences(value, context.referenceMap);

    return {
      snapshots: snapshots.map(rewriteValue),
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
    sourceReference: string,
    importPrefix: string,
    scormDirectory: NativeArchiveScormAssetDirectory | undefined,
    referenceMap: Map<string, string>,
  ): string {
    if (scormDirectory) {
      const relativePath = sourceReference.slice(scormDirectory.sourcePath.length + 1);

      return `${scormDirectory.targetReference}/${relativePath}`;
    }

    if (isImageVariantReference(sourceReference)) {
      return this.getImageVariantTargetReference(sourceReference, importPrefix, referenceMap);
    }

    const extension = path.posix.extname(sourceReference.split("?")[0] ?? "").slice(0, 16);

    return `${importPrefix}/files/${this.hashReference(sourceReference)}${extension}`;
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

  private async uploadAsset(
    archive: ParsedNativeArchive,
    asset: NativeArchiveAsset,
    targetReference: string,
  ): Promise<void> {
    const filePath = archive.assetFiles.get(asset.path);

    if (!filePath) throw new BadRequestException("nativeArchive.error.missingAsset");

    if (asset.byteLength === 0) {
      await this.s3Service.uploadFile(Buffer.alloc(0), targetReference, asset.contentType, 0);

      return;
    }

    await this.s3Service.uploadStreamMultipart(
      createReadStream(filePath),
      targetReference,
      asset.contentType,
    );
  }

  private rewriteReferences<T>(value: T, referenceMap: ReadonlyMap<string, string>): T {
    return cloneDeepWith(value, (item) =>
      typeof item === "string" ? (referenceMap.get(item) ?? item) : undefined,
    );
  }

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
