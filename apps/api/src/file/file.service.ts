import { randomUUID } from "crypto";
import { Readable } from "stream";

import {
  Inject,
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ALLOWED_VIDEO_FILE_TYPES, ENTITY_TYPES, VIDEO_UPLOAD_STATUS } from "@repo/shared";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { CacheManagerStore } from "cache-manager";
import { parse } from "csv-parse";
import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import readXlsxFile from "read-excel-file/node";
import sharp from "sharp";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { DatabasePg } from "src/common";
import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { uploadKey, videoKey } from "src/file/utils/bunnyCacheKeys";
import { isEmptyObject, normalizeCellValue, normalizeHeader } from "src/file/utils/excel.utils";
import getChecksum from "src/file/utils/getChecksum";
import { S3Service } from "src/s3/s3.service";
import { resources, resourceEntity } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import {
  ALLOWED_EXCEL_MIME_TYPES_MAP,
  RESOURCE_RELATIONSHIP_TYPES,
  MAX_VIDEO_SIZE,
} from "./file.constants";
import { BunnyVideoProvider } from "./providers/bunny-video.provider";
import { S3VideoProvider } from "./providers/s3-video.provider";
import { CONTEXT_TTL, getContextKey } from "./utils/resourceCacheKeys";
import { VideoProcessingStateService } from "./video-processing-state.service";
import { VideoUploadNotificationGateway } from "./video-upload-notification.gateway";

import type { BunnyWebhookBody } from "./schemas/bunny-webhook.schema";
import type { VideoInitBody } from "./schemas/video-init.schema";
import type { VideoUploadState } from "./video-processing-state.service";
import type {
  VideoProviderInitPayload,
  VideoProviderInitResult,
  VideoStorageProvider,
} from "./video-storage-provider";
import type { SupportedLanguages, EntityType } from "@repo/shared";
import type { Static, TSchema } from "@sinclair/typebox";
import type { UUIDType } from "src/common";
import type {
  UploadResourceParams,
  CreateResourceForEntityParams,
} from "src/file/types/resource.types";

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly bunnyStreamService: BunnyStreamService,
    private readonly videoProcessingStateService: VideoProcessingStateService,
    private readonly bunnyVideoProvider: BunnyVideoProvider,
    private readonly s3VideoProvider: S3VideoProvider,
    @Inject("DB") private readonly db: DatabasePg,
    @Inject("CACHE_MANAGER") private readonly cache: CacheManagerStore,
    private readonly notificationGateway: VideoUploadNotificationGateway,
  ) {}

  async getFileUrl(fileKey: string): Promise<string> {
    if (!fileKey) return "https://app.lms.localhost/app/assets/placeholders/card-placeholder.jpg";
    if (fileKey.startsWith("https://")) return fileKey;
    if (fileKey.startsWith("bunny-")) {
      const videoId = fileKey.replace("bunny-", "");

      return this.bunnyStreamService.getUrl(videoId);
    }
    return await this.s3Service.getSignedUrl(fileKey);
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

      const buffer = await this.s3Service.getFileBuffer(fileKey);
      return sharp(buffer, { density: 300 }).toBuffer();
    } catch (error) {
      return null;
    }
  }

  async uploadFile(file: Express.Multer.File, resource: string) {
    if (file.size === 0) {
      throw new BadRequestException("File upload failed - empty file");
    }

    const isVideo = file.mimetype.startsWith("video/");

    try {
      if (isVideo) {
        throw new BadRequestException("Video uploads must use the TUS endpoints");
      }

      const fileExtension = file.originalname.split(".").pop();
      const fileKey = `${resource}/${randomUUID()}.${fileExtension}`;

      try {
        await this.s3Service.uploadFile(file.buffer, fileKey, file.mimetype);
      } catch (s3Error) {
        throw new ConflictException("S3 upload failed");
      }

      const fileUrl = await this.s3Service.getSignedUrl(fileKey);

      return {
        fileKey,
        fileUrl,
      };
    } catch (error) {
      throw new ConflictException("Failed to upload file");
    }
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
  ) {
    await this.videoProcessingStateService.initializeState(
      uploadId,
      placeholderKey,
      fileType,
      currentUserId,
    );
  }

  private async initProviderUpload(
    provider: VideoStorageProvider,
    payload: VideoProviderInitPayload,
    uploadId: string,
    placeholderKey: string,
  ) {
    try {
      return provider.initVideoUpload(payload);
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

  private async createLessonContentResourceIfNeeded(params: {
    entityType: EntityType;
    entityId?: UUIDType;
    fileKey: string;
    mimeType: string;
    filename: string;
    sizeBytes: number;
    contextId?: UUIDType;
  }) {
    const { entityType, entityId, fileKey, mimeType, filename, sizeBytes, contextId } = params;

    if (!entityId && !contextId) return undefined;

    const resourceResult = await this.createResourceForEntity({
      reference: fileKey,
      contentType: mimeType,
      entityId,
      entityType,
      relationshipType: RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      metadata: {
        originalFilename: filename,
        size: sizeBytes,
      },
      contextId,
    });

    return resourceResult.resourceId;
  }

  async initVideoUpload(data: VideoInitBody, currentUserId?: UUIDType) {
    const {
      filename,
      sizeBytes,
      mimeType,
      title,
      resource = ENTITY_TYPES.LESSON,
      contextId,
      entityId,
      entityType,
    } = data;

    if (!entityId && !contextId) {
      throw new BadRequestException("Missing entityId or contextId");
    }

    if (!ALLOWED_VIDEO_FILE_TYPES.includes(mimeType)) {
      throw new BadRequestException("Invalid video mime type");
    }

    if (sizeBytes > MAX_VIDEO_SIZE) {
      throw new BadRequestException("Video file exceeds maximum allowed size");
    }

    const { uploadId, placeholderKey, fileType } = this.buildVideoUploadContext(resource, filename);

    await this.initializeVideoUploadState(uploadId, placeholderKey, fileType, currentUserId);

    const provider = await this.resolveVideoProvider();
    const providerResponse = await this.initProviderUpload(
      provider,
      {
        filename,
        title,
        mimeType,
        resource,
      },
      uploadId,
      placeholderKey,
    );

    await this.registerProviderUpload(uploadId, placeholderKey, providerResponse);

    const resourceId = await this.createLessonContentResourceIfNeeded({
      entityType,
      entityId,
      fileKey: providerResponse.fileKey,
      mimeType,
      filename,
      sizeBytes,
      contextId,
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
      return await this.s3Service.deleteFile(fileKey);
    } catch (error) {
      throw new ConflictException("Failed to delete file");
    }
  }

  async getFileStream(fileKey: string) {
    try {
      return await this.s3Service.getFileStream(fileKey);
    } catch (error) {
      throw new BadRequestException("Failed to retrieve file");
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

    const { fileKey } = await this.uploadFile(file, resourceFolder);

    const { insertedResource } = await this.db.transaction(async (trx) => {
      const [insertedResource] = await trx
        .insert(resources)
        .values({
          title: buildJsonbFieldWithMultipleEntries(title || {}),
          description: buildJsonbFieldWithMultipleEntries(description || {}),
          reference: fileKey,
          contentType: file.mimetype,
          metadata: settingsToJSONBuildObject({
            originalFilename: file.originalname,
            size: file.size,
            checksum,
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
      fileKey,
      fileUrl: await this.getFileUrl(fileKey),
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
  ) {
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
}
