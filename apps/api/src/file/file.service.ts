import { randomUUID } from "crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "stream";

import {
  Inject,
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import {
  ALLOWED_PRESENTATION_FILE_TYPES,
  ALLOWED_VIDEO_FILE_TYPES,
  ENTITY_TYPES,
  VIDEO_UPLOAD_STATUS,
  type VideoProvider,
  type SupportedLanguages,
  type EntityType,
} from "@repo/shared";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { CacheManagerStore } from "cache-manager";
import { parse } from "csv-parse";
import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import readXlsxFile from "read-excel-file/node";
import sharp from "sharp";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { DatabasePg } from "src/common";
import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { IMAGE_QUALITY } from "src/file/image-variants/image-variant.constants";
import { ImageVariantService } from "src/file/image-variants/image-variant.service";
import {
  getAllImageVariantKeys,
  getImageVariantKey,
  isImageVariantReference,
} from "src/file/image-variants/image-variant.utils";
import { FILE_DELIVERY_TYPE, type FileDeliveryResult } from "src/file/types/file-delivery.type";
import {
  FILE_PREVIEW_FORMAT,
  type FilePreviewDeliveryOptions,
} from "src/file/types/file-preview.type";
import { uploadKey, videoKey } from "src/file/utils/bunnyCacheKeys";
import { isEmptyObject, normalizeCellValue, normalizeHeader } from "src/file/utils/excel.utils";
import getChecksum from "src/file/utils/getChecksum";
import { S3Service } from "src/s3/s3.service";
import { resources, resourceEntity } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import {
  ALLOWED_EXCEL_MIME_TYPES_MAP,
  MAX_PRESENTATION_FILE_SIZE,
  MAX_PRESENTATION_FILE_SIZE_UNIT,
  MAX_PRESENTATION_FILE_SIZE_VALUE,
  PRESENTATION_PDF_PREVIEW_CONTENT_TYPE,
  MAX_COURSE_TRAILER_VIDEO_SIZE,
  RESOURCE_RELATIONSHIP_TYPES,
  MAX_VIDEO_SIZE,
} from "./file.constants";
import { BunnyVideoProvider } from "./providers/bunny-video.provider";
import { S3VideoProvider } from "./providers/s3-video.provider";
import { ThumbnailService } from "./thumbnail.service";
import { convertPresentationToPdf } from "./utils/convertPresentationToPdf";
import { CONTEXT_TTL, getContextKey } from "./utils/resourceCacheKeys";
import { prefixTenantStorageKey } from "./utils/tenantStorageKey";
import { VideoProcessingStateService } from "./video-processing-state.service";
import { VideoUploadNotificationGateway } from "./video-upload-notification.gateway";

import type { ResourceRelationshipType } from "./file.constants";
import type { BunnyWebhookBody } from "./schemas/bunny-webhook.schema";
import type { VideoInitBody } from "./schemas/video-init.schema";
import type { VideoUploadState } from "./video-processing-state.service";
import type {
  VideoProviderInitPayload,
  VideoProviderInitResult,
  VideoStorageProvider,
} from "./video-storage-provider";
import type { Static, TSchema } from "@sinclair/typebox";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { ImageQuality } from "src/file/image-variants/image-variant.types";
import type {
  UploadResourceParams,
  CreateResourceForEntityParams,
  ResourceForEntity,
} from "src/file/types/resource.types";
import type { UploadFileResult } from "src/file/types/upload-file-result.type";

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly bunnyStreamService: BunnyStreamService,
    private readonly videoProcessingStateService: VideoProcessingStateService,
    private readonly bunnyVideoProvider: BunnyVideoProvider,
    private readonly s3VideoProvider: S3VideoProvider,
    private readonly thumbnailService: ThumbnailService,
    private readonly imageVariantService: ImageVariantService,
    @Inject("DB") private readonly db: DatabasePg,
    @Inject("CACHE_MANAGER") private readonly cache: CacheManagerStore,
    private readonly notificationGateway: VideoUploadNotificationGateway,
  ) {}

  async getFileUrl(fileKey: string): Promise<string> {
    if (!fileKey) return "https://app.lms.localhost/app/assets/placeholders/card-placeholder.jpg";
    if (fileKey.startsWith("https://") || fileKey.startsWith("http://")) return fileKey;
    if (fileKey.startsWith("bunny-")) {
      const videoId = fileKey.replace("bunny-", "");

      return this.bunnyStreamService.getUrl(videoId);
    }

    if (isImageVariantReference(fileKey)) {
      return this.getImageUrlByQuality(fileKey);
    }

    return this.s3Service.getSignedUrl(fileKey);
  }

  async getImageUrlByQuality(
    reference: string,
    quality: ImageQuality = IMAGE_QUALITY.HIGH,
  ): Promise<string> {
    if (!isImageVariantReference(reference)) return this.s3Service.getSignedUrl(reference);

    return this.s3Service.getSignedUrl(this.getFileStorageKeyByQuality(reference, quality));
  }

  async getFileContentType(fileKey: string): Promise<string | null> {
    if (!fileKey) return null;
    if (isImageVariantReference(fileKey)) return "image/webp";

    return this.s3Service.getFileContentType(fileKey);
  }

  async isBunnyConfigured(): Promise<boolean> {
    try {
      return await this.bunnyStreamService.isConfigured();
    } catch {
      return false;
    }
  }

  async getFileBuffer(fileKey: string): Promise<Buffer | null> {
    if (!fileKey) return null;

    try {
      if (fileKey.startsWith("https://") || fileKey.startsWith("http://")) {
        const response = await fetch(fileKey);

        if (!response.ok) {
          throw new Error(`Failed to download remote file: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return sharp(Buffer.from(arrayBuffer), { density: 300 }).toBuffer();
      }

      const buffer = await this.s3Service.getFileBuffer(this.getFileStorageKey(fileKey));
      return sharp(buffer, { density: 300 }).toBuffer();
    } catch (error) {
      return null;
    }
  }

  async getRawFileBuffer(fileKey: string): Promise<Buffer | null> {
    if (!fileKey) return null;

    try {
      if (fileKey.startsWith("https://") || fileKey.startsWith("http://")) {
        const response = await fetch(fileKey);

        if (!response.ok) {
          throw new Error(`Failed to download remote file: ${response.status}`);
        }

        return Buffer.from(await response.arrayBuffer());
      }

      return await this.s3Service.getFileBuffer(this.getFileStorageKey(fileKey));
    } catch {
      return null;
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    resource: string,
    tenantId?: UUIDType,
  ): Promise<UploadFileResult> {
    if (file.size === 0) {
      throw new BadRequestException("files.toast.fileEmpty");
    }

    if (!tenantId) throw new BadRequestException("files.toast.missingTenantContext");

    const isVideo = file.mimetype.startsWith("video/");

    if (isVideo) {
      throw new BadRequestException("Video uploads must use the TUS endpoints");
    }

    if (
      ALLOWED_PRESENTATION_FILE_TYPES.includes(file.mimetype) &&
      file.size > MAX_PRESENTATION_FILE_SIZE
    ) {
      throw new BadRequestException({
        message: "files.toast.presentationFileTooLarge",
        translationParams: {
          size: MAX_PRESENTATION_FILE_SIZE_VALUE,
          unit: MAX_PRESENTATION_FILE_SIZE_UNIT,
        },
      });
    }

    const imageVariantResult = await this.imageVariantService.createVariants({
      buffer: file.buffer,
      resource,
      mimeType: file.mimetype,
      tenantId,
    });

    if (imageVariantResult) {
      return {
        fileKey: imageVariantResult.referenceKey,
        fileUrl: await this.getImageUrlByQuality(imageVariantResult.referenceKey),
        contentType: imageVariantResult.contentType,
        imageVariants: imageVariantResult.metadata,
      };
    }

    const fileExtension = path.extname(file.originalname);

    const fileKey = prefixTenantStorageKey(`${resource}/${randomUUID()}${fileExtension}`, tenantId);

    try {
      await this.s3Service.uploadFile(file.buffer, fileKey, file.mimetype);
    } catch (s3Error) {
      this.logFileOperationFailure("upload", fileKey, s3Error);
      throw new ConflictException("S3 upload failed");
    }

    const fileUrl = await this.s3Service.getSignedUrl(fileKey);

    return {
      fileKey,
      fileUrl,
      contentType: file.mimetype,
    };
  }

  private async resolveVideoProvider() {
    if (await this.bunnyVideoProvider.isAvailable()) {
      return this.bunnyVideoProvider;
    }

    if (await this.s3VideoProvider.isAvailable()) {
      this.logger.warn("Bunny configuration missing, falling back to S3 for video uploads.");
      return this.s3VideoProvider;
    }

    throw new InternalServerErrorException("Video storage is not configured.");
  }

  private buildVideoUploadContext(resource: string, filename?: string) {
    const uploadId = randomUUID();
    const placeholderKey = `processing-${resource}-${uploadId}`;
    const fileType = filename?.split(".").pop();

    return { uploadId, placeholderKey, fileType };
  }

  private async initializeVideoUploadState(
    uploadId: string,
    placeholderKey: string,
    fileType: string | undefined,
    currentUserId?: UUIDType,
    maxUploadSize?: number,
  ) {
    await this.videoProcessingStateService.initializeState(
      uploadId,
      placeholderKey,
      fileType,
      currentUserId,
      { maxUploadSize },
    );
  }

  private async initProviderUpload(
    provider: VideoStorageProvider,
    payload: VideoProviderInitPayload,
    uploadId: string,
    placeholderKey: string,
  ) {
    try {
      return await provider.initVideoUpload(payload);
    } catch (error) {
      await this.videoProcessingStateService.markFailed(uploadId, placeholderKey, error?.message);
      throw error;
    }
  }

  private async registerProviderUpload(
    uploadId: string,
    placeholderKey: string,
    providerResponse: VideoProviderInitResult,
  ) {
    await this.videoProcessingStateService.updateState(uploadId, {
      fileKey: providerResponse.fileKey,
      provider: providerResponse.provider,
      bunnyVideoId: providerResponse.bunnyGuid,
      multipartUploadId: providerResponse.multipartUploadId,
      partSize: providerResponse.partSize,
    });

    if (providerResponse.bunnyGuid) {
      await this.videoProcessingStateService.registerVideoId({
        uploadId,
        bunnyVideoId: providerResponse.bunnyGuid,
        placeholderKey,
        fileKey: providerResponse.fileKey,
        provider: providerResponse.provider,
      });
    }
  }

  private async createResourceIfNeeded(params: {
    entityType: EntityType;
    entityId?: UUIDType;
    fileKey: string;
    mimeType: string;
    filename: string;
    sizeBytes: number;
    contextId?: UUIDType;
    relationshipType?: ResourceRelationshipType;
    linkToEntity?: boolean;
  }) {
    const {
      entityType,
      entityId,
      fileKey,
      mimeType,
      filename,
      sizeBytes,
      contextId,
      relationshipType = RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      linkToEntity = true,
    } = params;

    if (!entityId && !contextId) return undefined;

    const resourceResult = await this.createResourceForEntity({
      reference: fileKey,
      contentType: mimeType,
      entityId: linkToEntity ? entityId : undefined,
      entityType: linkToEntity ? entityType : undefined,
      relationshipType,
      metadata: {
        originalFilename: filename,
        size: sizeBytes,
      },
      contextId,
    });

    return resourceResult.resourceId;
  }

  async initVideoUpload(data: VideoInitBody, currentUser?: CurrentUserType) {
    const {
      filename,
      sizeBytes,
      mimeType,
      title,
      resource = ENTITY_TYPES.LESSON,
      contextId,
      entityId,
      entityType,
      relationshipType = RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      linkToEntity = true,
    } = data as VideoInitBody & { relationshipType?: ResourceRelationshipType };

    if (!entityId && !contextId) {
      throw new BadRequestException("Missing entityId or contextId");
    }

    if (!ALLOWED_VIDEO_FILE_TYPES.includes(mimeType)) {
      throw new BadRequestException("Invalid video mime type");
    }

    const isCourseTrailer =
      entityType === ENTITY_TYPES.COURSE &&
      relationshipType === RESOURCE_RELATIONSHIP_TYPES.TRAILER;

    const maxUploadSize = isCourseTrailer ? MAX_COURSE_TRAILER_VIDEO_SIZE : MAX_VIDEO_SIZE;

    if (sizeBytes > maxUploadSize) {
      throw new BadRequestException("uploadFile.toast.videoTooLarge");
    }

    const { uploadId, placeholderKey, fileType } = this.buildVideoUploadContext(resource, filename);

    if (entityId && entityType && relationshipType !== RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT) {
      const existingResources = await this.db
        .select({ id: resources.id })
        .from(resources)
        .innerJoin(resourceEntity, eq(resources.id, resourceEntity.resourceId))
        .where(
          and(
            eq(resourceEntity.entityId, entityId),
            eq(resourceEntity.entityType, entityType),
            eq(resourceEntity.relationshipType, relationshipType),
            eq(resources.archived, false),
          ),
        );

      if (existingResources.length > 0) {
        await this.archiveResources(existingResources.map((r) => r.id));
      }
    }

    await this.initializeVideoUploadState(
      uploadId,
      placeholderKey,
      fileType,
      currentUser?.userId,
      maxUploadSize,
    );

    const provider = await this.resolveVideoProvider();
    const providerResponse = await this.initProviderUpload(
      provider,
      {
        filename,
        title,
        mimeType,
        resource,
        tenantId: currentUser?.tenantId,
      },
      uploadId,
      placeholderKey,
    );

    await this.registerProviderUpload(uploadId, placeholderKey, providerResponse);

    const resourceId = await this.createResourceIfNeeded({
      entityType,
      entityId,
      fileKey: providerResponse.fileKey,
      mimeType,
      filename,
      sizeBytes,
      contextId,
      relationshipType,
      linkToEntity,
    });

    return {
      uploadId,
      provider: providerResponse.provider,
      bunnyGuid: providerResponse.bunnyGuid,
      fileKey: providerResponse.fileKey,
      tusEndpoint: providerResponse.tusEndpoint,
      tusHeaders: providerResponse.tusHeaders,
      expiresAt: providerResponse.expiresAt,
      multipartUploadId: providerResponse.multipartUploadId,
      partSize: providerResponse.partSize,
      resourceId,
    };
  }

  async deleteFile(fileKey: string) {
    try {
      if (fileKey.startsWith("bunny-")) {
        const videoId = fileKey.replace("bunny-", "");
        return await this.bunnyStreamService.delete(videoId);
      }
      if (isImageVariantReference(fileKey)) {
        await Promise.all(
          getAllImageVariantKeys(fileKey).map((key) => this.s3Service.deleteFile(key)),
        );
        return;
      }

      return await this.s3Service.deleteFile(fileKey);
    } catch (error) {
      this.logFileOperationFailure("delete", fileKey, error);
      throw new ConflictException("Failed to delete file");
    }
  }

  async getFileStream(fileKey: string, range?: string) {
    try {
      return await this.s3Service.getFileStream(this.getFileStorageKey(fileKey), range);
    } catch (error) {
      this.logFileOperationFailure("retrieve", fileKey, error);
      throw new BadRequestException("Failed to retrieve file");
    }
  }

  private logFileOperationFailure(operation: string, fileKey: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    this.logger.error(
      `Failed to ${operation} file "${fileKey}": ${message}`,
      error instanceof Error ? error.stack : undefined,
    );
  }

  async listFileReferencesByPrefix(prefix: string) {
    return this.s3Service.listFileKeysByPrefix(prefix);
  }

  private getFileStorageKey(reference: string) {
    return this.getFileStorageKeyByQuality(reference, IMAGE_QUALITY.HIGH);
  }

  private getFileStorageKeyByQuality(reference: string, quality: ImageQuality) {
    if (!isImageVariantReference(reference)) return reference;

    return getImageVariantKey(reference, quality);
  }

  async getFileDelivery(fileKey: string, range?: string): Promise<FileDeliveryResult> {
    if (!fileKey) {
      throw new BadRequestException("Failed to retrieve file");
    }

    if (fileKey.startsWith("bunny-")) {
      try {
        const videoId = fileKey.replace("bunny-", "");
        const url = await this.bunnyStreamService.getUrl(videoId);
        return { type: FILE_DELIVERY_TYPE.REDIRECT, url };
      } catch {
        throw new BadRequestException("Failed to retrieve file");
      }
    }

    const stream = await this.getFileStream(fileKey, range);
    return { type: FILE_DELIVERY_TYPE.STREAM, ...stream };
  }

  async getFileDeliveryWithPreview(
    fileKey: string,
    options: FilePreviewDeliveryOptions = {},
  ): Promise<FileDeliveryResult> {
    if (options.preview === FILE_PREVIEW_FORMAT.PDF) {
      return this.getPresentationPdfPreviewDelivery(
        fileKey,
        options.contentType ?? "",
        options.range,
      );
    }

    return this.getFileDelivery(fileKey, options.range);
  }

  async getPresentationPdfPreviewDelivery(
    fileKey: string,
    contentType: string,
    range?: string,
  ): Promise<FileDeliveryResult> {
    if (!ALLOWED_PRESENTATION_FILE_TYPES.includes(contentType)) {
      throw new BadRequestException("files.toast.invalidFileType");
    }

    const pdfPreviewKey = await this.getOrCreatePresentationPdfPreview(fileKey);
    const stream = await this.getFileStream(pdfPreviewKey, range);

    return {
      type: FILE_DELIVERY_TYPE.STREAM,
      ...stream,
      contentType: PRESENTATION_PDF_PREVIEW_CONTENT_TYPE,
    };
  }

  private async getOrCreatePresentationPdfPreview(fileKey: string) {
    if (
      fileKey.startsWith("http://") ||
      fileKey.startsWith("https://") ||
      fileKey.startsWith("bunny-")
    ) {
      throw new BadRequestException("files.toast.previewGenerationFailed");
    }

    const pdfPreviewKey = `${fileKey}.preview.pdf`;

    if (await this.s3Service.getFileExists(pdfPreviewKey)) return pdfPreviewKey;

    const tempDirectory = await mkdtemp(path.join(tmpdir(), "mentingo-presentation-"));
    const inputExtension = path.extname(fileKey) || ".pptx";

    const inputPath = path.join(tempDirectory, `presentation${inputExtension}`);
    const outputPath = path.join(tempDirectory, "presentation.pdf");

    try {
      const fileBuffer = await this.s3Service.getFileBuffer(fileKey);

      await writeFile(inputPath, fileBuffer);
      await convertPresentationToPdf(inputPath, tempDirectory);

      const pdfBuffer = await readFile(outputPath);
      await this.s3Service.uploadFile(
        pdfBuffer,
        pdfPreviewKey,
        PRESENTATION_PDF_PREVIEW_CONTENT_TYPE,
      );

      return pdfPreviewKey;
    } catch (error) {
      this.logger.error(
        `Failed to generate presentation PDF preview for "${fileKey}": ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException("files.toast.previewGenerationFailed");
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }

  async parseExcelFile<T extends TSchema>(
    file: Express.Multer.File,
    schema: T,
  ): Promise<Static<T>[]> {
    if (!file) {
      throw new BadRequestException({ message: "files.import.noFileUploaded" });
    }

    if (!file.originalname || !file.buffer) {
      throw new BadRequestException({ message: "files.import.invalidFileData" });
    }

    const validator = TypeCompiler.Compile(schema);

    const rows =
      file.mimetype === ALLOWED_EXCEL_MIME_TYPES_MAP.csv
        ? await this.readCsvToRows(file.buffer)
        : await readXlsxFile(file.buffer, { sheet: 1 });

    if (!rows || rows.length <= 1)
      throw new BadRequestException({ message: "files.import.fileEmpty" });

    const headers = rows[0].map(normalizeHeader);
    const dataRows = rows.slice(1);

    const parsed = dataRows.map((rowValues) => {
      if (!Array.isArray(rowValues)) return;

      const parsedObject: Record<string, string | string[]> = {};

      headers.forEach((header, colIndex) => {
        if (!header) return;

        const v = normalizeCellValue(header, rowValues[colIndex]);
        if (v !== undefined) parsedObject[header] = v;
      });

      if (isEmptyObject(parsedObject)) return null;

      const schemaKeys = Object.keys(schema.properties || {});
      const filteredObject = Object.fromEntries(
        Object.entries(parsedObject).filter(([key]) => schemaKeys.includes(key)),
      );

      if (!validator.Check(filteredObject)) {
        throw new BadRequestException({
          message: "files.import.requiredDataMissing",
        });
      }

      return validator.Encode(filteredObject) as Static<T>;
    });

    return parsed.filter((item) => item !== null);
  }

  async readCsvToRows(buffer: Buffer, delimiter = ","): Promise<any[][]> {
    const parseWithDelimiter = (delim: string) =>
      new Promise<any[][]>((res, rej) => {
        const parsed: any[][] = [];
        const input = Readable.from(buffer);
        input
          .pipe(
            parse({
              delimiter: delim,
              relax_quotes: true,
              bom: true,
              trim: true,
              skip_empty_lines: true,
            }),
          )
          .on("data", (row) => parsed.push(row))
          .on("end", () => res(parsed))
          .on("error", rej);
      });

    const maxSemicolonAttempts = 5;
    const delimiters = [delimiter, ...Array.from({ length: maxSemicolonAttempts }, () => ";")];

    let lastError: unknown;
    for (const delim of delimiters) {
      try {
        const parsed = await parseWithDelimiter(delim);
        if (parsed.length && parsed[0].length > 1) return parsed;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  /**
   * Upload a file and create a resource record linked to an entity
   * @param file - The uploaded file from Express.Multer
   * @param resource - The resource path/category for organizing uploads (e.g., 'courses', 'lessons')
   * @param entityId - The ID of the entity this resource belongs to
   * @param entityType - The type of entity (e.g., 'course', 'lesson', 'chapter', 'question')
   * @param relationshipType - The relationship between resource and entity (default: 'attachment')
   * @param currentUser - Current user object
   * @param title - Multilingual title object (optional)
   * @param description - Multilingual description object (optional)
   * @returns Object containing resourceId, fileKey, and fileUrl
   */
  async uploadResource({
    file,
    folder,
    resource,
    entityId,
    entityType,
    relationshipType = RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
    title,
    description,
    currentUser,
    options,
  }: UploadResourceParams) {
    const resourceFolder = options?.folderIncludesResource ? folder : `${resource}/${folder}`;

    const checksum = getChecksum(file);

    const uploadResult = await this.uploadFile(file, resourceFolder, currentUser?.tenantId);

    const { insertedResource } = await this.db.transaction(async (trx) => {
      const [insertedResource] = await trx
        .insert(resources)
        .values({
          title: buildJsonbFieldWithMultipleEntries(title || {}),
          description: buildJsonbFieldWithMultipleEntries(description || {}),
          reference: uploadResult.fileKey,
          contentType: uploadResult.contentType,
          metadata: settingsToJSONBuildObject({
            originalFilename: file.originalname,
            size: file.size,
            checksum,
            ...(uploadResult.imageVariants ? { imageVariants: uploadResult.imageVariants } : {}),
          }),
          uploadedBy: currentUser?.userId || null,
        })
        .returning();

      if (options?.contextId) {
        const contextKey = getContextKey(options.contextId);

        const existingResources = (await this.cache.get(contextKey)) as UUIDType[];

        await this.cache.set(contextKey, [...existingResources, insertedResource.id], CONTEXT_TTL);
      }

      if (entityType && entityId) {
        await trx.insert(resourceEntity).values({
          resourceId: insertedResource.id,
          entityId,
          entityType,
          relationshipType,
        });
      }

      return { insertedResource };
    });

    if (!insertedResource) throw new BadRequestException("adminResources.toast.uploadError");

    return {
      resourceId: insertedResource.id,
      fileKey: uploadResult.fileKey,
      fileUrl: await this.getFileUrl(uploadResult.fileKey),
    };
  }

  /**
   * Create a resource record linked to an entity without uploading a file.
   */

  async createResourceForEntity({
    reference,
    contentType,
    entityId,
    entityType,
    relationshipType = RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
    metadata = {},
    title = {},
    description = {},
    currentUser,
    contextId,
  }: CreateResourceForEntityParams) {
    const { insertedResource } = await this.db.transaction(async (trx) => {
      const [insertedResource] = await trx
        .insert(resources)
        .values({
          title: buildJsonbFieldWithMultipleEntries(title || {}),
          description: buildJsonbFieldWithMultipleEntries(description || {}),
          reference,
          contentType,
          metadata: settingsToJSONBuildObject(metadata),
          uploadedBy: currentUser?.userId || null,
        })
        .returning();

      if (contextId) {
        const contextKey = getContextKey(contextId);

        const existingResources = (await this.cache.get(contextKey)) as UUIDType[];

        await this.cache.set(contextKey, [...existingResources, insertedResource.id], CONTEXT_TTL);
      }

      if (entityType && entityId) {
        await trx.insert(resourceEntity).values({
          resourceId: insertedResource.id,
          entityId,
          entityType,
          relationshipType,
        });
      }

      return { insertedResource };
    });

    if (!insertedResource) throw new BadRequestException("adminResources.toast.uploadError");

    return {
      resourceId: insertedResource.id,
      fileUrl: await this.getFileUrl(reference),
    };
  }

  /**
   * Get all resources for a specific entity
   * @param entityId - The ID of the entity
   * @param entityType - The type of entity (e.g., 'course', 'lesson', 'chapter', 'question')
   * @param relationshipType - Filter by relationship type (optional)
   * @returns Array of resources with file URLs
   */
  async getResourcesForEntity(
    entityId: UUIDType,
    entityType: EntityType,
    relationshipType?: string,
    language?: SupportedLanguages,
  ): Promise<ResourceForEntity[]> {
    const conditions = [
      eq(resourceEntity.entityId, entityId),
      eq(resourceEntity.entityType, entityType),
      eq(resources.archived, false),
      relationshipType ? eq(resourceEntity.relationshipType, relationshipType) : null,
    ].filter((condition): condition is ReturnType<typeof eq> => Boolean(condition));

    const resourceSelect = language
      ? {
          ...getTableColumns(resources),
          title: sql`COALESCE(${resources.title}->>${language}::text,'')`,
          description: sql`COALESCE(${resources.description}->>${language}::text,'')`,
        }
      : getTableColumns(resources);

    const results = await this.db
      .select({
        ...resourceSelect,
        resourceEntityId: resourceEntity.id,
      })
      .from(resources)
      .innerJoin(resourceEntity, eq(resources.id, resourceEntity.resourceId))
      .where(and(...conditions));

    return Promise.all(
      results.map(async (resource) => {
        try {
          const fileUrl = await this.getFileUrl(resource.reference);
          return { ...resource, fileUrl };
        } catch (error) {
          return { ...resource, fileUrl: resource.reference, fileUrlError: true };
        }
      }),
    );
  }

  async archiveResources(resourceIds: UUIDType[]) {
    if (!resourceIds.length) return;

    await this.db
      .update(resources)
      .set({ archived: true })
      .where(and(eq(resources.archived, false), inArray(resources.id, resourceIds)));
  }

  async getVideoUploadStatus(uploadId: string): Promise<VideoUploadState | null> {
    if (!uploadId) return null;
    return this.videoProcessingStateService.getState(uploadId);
  }

  async handleBunnyWebhook(payload: BunnyWebhookBody & Record<string, unknown>) {
    const status = payload.status ?? payload.Status ?? 0;

    const videoId =
      payload.videoId ||
      payload.VideoId ||
      payload.videoGuid ||
      payload.VideoGuid ||
      payload.guid ||
      (payload as Record<string, string>)?.["Guid"];

    if (!videoId) {
      throw new BadRequestException("Missing video identifier");
    }

    if (Number(status) !== 3) {
      return { ignored: true };
    }

    const fileKey = `bunny-${videoId}`;
    const fileUrl = await this.bunnyStreamService.getUrl(videoId);

    const cacheKey = videoKey(videoId);
    const uploadId = (await this.cache.get(cacheKey)) as string | undefined;

    const data = (await this.cache.get(uploadKey(uploadId ?? ""))) as VideoUploadState | undefined;

    if (uploadId) {
      await this.notificationGateway.publishNotification({
        uploadId,
        status: VIDEO_UPLOAD_STATUS.PROCESSED,
        fileKey,
        fileUrl,
        userId: data?.userId,
      });
    } else {
      throw new BadRequestException("No uploadId found in cache for videoId");
    }

    await this.videoProcessingStateService.markProcessed(videoId, fileUrl);

    return { success: true };
  }

  async getThumbnail(
    sourceUrl: string,
    provider: VideoProvider,
    currentUser: CurrentUserType | null,
  ) {
    return this.thumbnailService.getThumbnail(sourceUrl, provider, currentUser);
  }
}
