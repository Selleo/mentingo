import { randomUUID } from "crypto";
import { Readable } from "stream";

import { Inject, BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import {
  ALLOWED_EXCEL_FILE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ALLOWED_PDF_FILE_TYPES,
  ALLOWED_PRESENTATION_FILE_TYPES,
  ALLOWED_VIDEO_FILE_TYPES,
  ALLOWED_WORD_FILE_TYPES,
  VIDEO_UPLOAD_STATUS,
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
import { uploadKey, videoKey } from "src/file/utils/bunnyCacheKeys";
import { isEmptyObject, normalizeCellValue, normalizeHeader } from "src/file/utils/excel.utils";
import { S3Service } from "src/s3/s3.service";
import { resources, resourceEntity } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import {
  MAX_FILE_SIZE,
  ALLOWED_EXCEL_MIME_TYPES,
  ALLOWED_EXCEL_MIME_TYPES_MAP,
  ALLOWED_MIME_TYPES,
  RESOURCE_RELATIONSHIP_TYPES,
  MAX_VIDEO_SIZE,
} from "./file.constants";
import { FileGuard } from "./guards/file.guard";
import { VideoProcessingStateService } from "./video-processing-state.service";
import { VideoUploadNotificationGateway } from "./video-upload-notification.gateway";
import { VideoUploadQueueService } from "./video-upload-queue.service";

import type { ResourceRelationshipType, EntityType, ResourceCategory } from "./file.constants";
import type { FileValidationOptions } from "./guards/file.guard";
import type { BunnyWebhookBody } from "./schemas/bunny-webhook.schema";
import type { VideoInitBody } from "./schemas/video-init.schema";
import type { VideoUploadState } from "./video-processing-state.service";
import type { SupportedLanguages } from "@repo/shared";
import type { Static, TSchema } from "@sinclair/typebox";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

@Injectable()
export class FileService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly bunnyStreamService: BunnyStreamService,
    private readonly videoUploadQueueService: VideoUploadQueueService,
    private readonly videoProcessingStateService: VideoProcessingStateService,
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

  async uploadFile(
    file: Express.Multer.File,
    resource: string,
    lessonId?: string,
    options?: FileValidationOptions,
    currentUserId?: UUIDType,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    if (!file.originalname || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException("File upload failed - invalid file data");
    }

    if (file.size === 0) {
      throw new BadRequestException("File upload failed - empty file");
    }

    const isVideo = file.mimetype.startsWith("video/");

    try {
      const { type } = await FileGuard.validateFile(
        file,
        options ?? {
          allowedTypes: ALLOWED_MIME_TYPES,
          maxSize: isVideo ? MAX_VIDEO_SIZE : MAX_FILE_SIZE,
        },
      );

      if (isVideo) {
        const uploadId = randomUUID();
        const placeholderKey = `processing-${resource}-${uploadId}`;
        const fileType = file.originalname?.split(".").pop();

        try {
          await this.videoProcessingStateService.initializeState(
            uploadId,
            placeholderKey,
            fileType,
            currentUserId,
          );
        } catch (cacheError) {
          throw new BadRequestException("Cache service unavailable");
        }

        const { fileKey, fileUrl } = await this.bunnyStreamService.upload(file);

        try {
          await this.videoUploadQueueService.enqueueVideoUpload(
            fileKey,
            fileUrl,
            resource,
            uploadId,
            placeholderKey,
            fileType,
            lessonId,
          );
        } catch (queueError) {
          throw new ConflictException("Queue service unavailable");
        }

        return {
          fileKey: placeholderKey,
          status: "processing",
          uploadId,
        };
      }

      const fileExtension = file.originalname.split(".").pop();
      const fileKey = `${resource}/${randomUUID()}.${fileExtension}`;

      try {
        await this.s3Service.uploadFile(file.buffer, fileKey, type);
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

  async initVideoUpload(data: VideoInitBody, currentUserId?: UUIDType) {
    const { filename, sizeBytes, mimeType, title, resource = "lesson", lessonId } = data;

    if (!ALLOWED_VIDEO_FILE_TYPES.includes(mimeType)) {
      throw new BadRequestException("Invalid video mime type");
    }

    if (sizeBytes > MAX_VIDEO_SIZE) {
      throw new BadRequestException("Video file exceeds maximum allowed size");
    }

    const uploadId = randomUUID();
    const placeholderKey = `processing-${resource}-${uploadId}`;
    const fileType = filename?.split(".").pop();

    await this.videoProcessingStateService.initializeState(
      uploadId,
      placeholderKey,
      fileType,
      currentUserId,
    );

    let guid: string;

    try {
      const response = await this.bunnyStreamService.createVideo(title || filename);
      guid = response.guid;
      await this.videoProcessingStateService.registerVideoId({
        uploadId,
        bunnyVideoId: guid,
        placeholderKey,
      });

      if (lessonId) {
        await this.videoProcessingStateService.associateWithLesson(uploadId, lessonId);
      }
    } catch (error) {
      await this.videoProcessingStateService.markFailed(uploadId, placeholderKey, error?.message);
      throw error;
    }

    const { tusEndpoint, tusHeaders, expiresAt } =
      await this.bunnyStreamService.getTusUploadConfig(guid);

    return {
      uploadId,
      bunnyGuid: guid,
      fileKey: placeholderKey,
      tusEndpoint,
      tusHeaders,
      expiresAt,
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

    if (
      !ALLOWED_EXCEL_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_EXCEL_MIME_TYPES)[number])
    ) {
      throw new BadRequestException({ message: "files.import.invalidFileType" });
    }

    const validator = TypeCompiler.Compile(schema);

    const fileStream = Readable.from(file.buffer);

    const rows =
      file.mimetype === ALLOWED_EXCEL_MIME_TYPES_MAP.csv
        ? await this.readCsvToRows(fileStream)
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

  async readCsvToRows(input: Readable, delimiter = ","): Promise<any[][]> {
    return new Promise((resolve, reject) => {
      const rows: any[][] = [];
      input
        .pipe(
          parse({
            delimiter,
            relax_quotes: true,
            bom: true,
            trim: true,
            skip_empty_lines: true,
          }),
        )
        .on("data", (row) => rows.push(row))
        .on("end", () => resolve(rows))
        .on("error", reject);
    });
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
  async uploadResource(
    file: Express.Multer.File,
    folder: string,
    resource: ResourceCategory,
    entityId: string,
    entityType: EntityType,
    relationshipType: ResourceRelationshipType = RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
    title: Partial<Record<SupportedLanguages, string>> = {},
    description: Partial<Record<SupportedLanguages, string>> = {},
    currentUser?: CurrentUser,
    options?: { folderIncludesResource?: boolean },
  ) {
    const resourceFolder = options?.folderIncludesResource ? folder : `${resource}/${folder}`;

    const { fileKey } = await this.uploadFile(file, resourceFolder, undefined, {
      allowedTypes: [
        ...ALLOWED_PDF_FILE_TYPES,
        ...ALLOWED_EXCEL_FILE_TYPES,
        ...ALLOWED_WORD_FILE_TYPES,
        ...ALLOWED_VIDEO_FILE_TYPES,
        ...ALLOWED_LESSON_IMAGE_FILE_TYPES,
        ...ALLOWED_PRESENTATION_FILE_TYPES,
      ],
      maxSize: MAX_FILE_SIZE,
    });

    const { insertedResource } = await this.db.transaction(async (trx) => {
      const [insertedResource] = await trx
        .insert(resources)
        .values({
          title: buildJsonbFieldWithMultipleEntries(title || {}),
          description: buildJsonbFieldWithMultipleEntries(description || {}),
          reference: fileKey,
          contentType: file.mimetype,
          metadata: {
            originalFilename: file.originalname,
            size: file.size,
          },
          uploadedBy: currentUser?.userId || null,
        })
        .returning();

      await trx.insert(resourceEntity).values({
        resourceId: insertedResource.id,
        entityId,
        entityType,
        relationshipType,
      });

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
  async createResourceForEntity(
    reference: string,
    contentType: string,
    entityId: UUIDType,
    entityType: EntityType,
    relationshipType: ResourceRelationshipType = RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
    metadata: Record<string, unknown> = {},
    title: Partial<Record<SupportedLanguages, string>> = {},
    description: Partial<Record<SupportedLanguages, string>> = {},
    currentUser?: CurrentUser,
  ) {
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

      await trx.insert(resourceEntity).values({
        resourceId: insertedResource.id,
        entityId,
        entityType,
        relationshipType,
      });

      return { insertedResource };
    });

    if (!insertedResource) throw new BadRequestException("adminResources.toast.uploadError");

    return {
      resourceId: insertedResource.id,
      fileUrl: await this.getFileUrl(reference),
    };
  }

  async updateResource(
    resourceId: UUIDType,
    updates: {
      reference?: string;
      contentType?: string;
      metadata?: Record<string, unknown>;
      title?: Partial<Record<SupportedLanguages, string>>;
      description?: Partial<Record<SupportedLanguages, string>>;
    },
  ) {
    const [updated] = await this.db
      .update(resources)
      .set({
        reference: updates.reference,
        contentType: updates.contentType,
        metadata: updates.metadata,
        title: updates.title ? buildJsonbFieldWithMultipleEntries(updates.title) : undefined,
        description: updates.description
          ? buildJsonbFieldWithMultipleEntries(updates.description)
          : undefined,
      })
      .where(eq(resources.id, resourceId))
      .returning();

    return updated;
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
    entityType: string,
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
      results.map(async (resource) => ({
        ...resource,
        fileUrl: await this.getFileUrl(resource.reference),
      })),
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

  async associateUploadWithLesson(uploadId: string, lessonId: string) {
    await this.videoProcessingStateService.associateWithLesson(uploadId, lessonId);
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

    const state = await this.videoProcessingStateService.markProcessed(videoId, fileUrl);

    if (state?.placeholderKey) {
      await this.db
        .update(resources)
        .set({ reference: fileKey })
        .where(eq(resources.reference, state.placeholderKey));
    }

    return { success: true };
  }
}
