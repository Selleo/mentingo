import { randomUUID } from "crypto";
import { Readable } from "stream";

import { Inject, BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { eq } from "drizzle-orm";
import Excel from "exceljs";
import { isEmpty } from "lodash";
import sharp from "sharp";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { DatabasePg } from "src/common";
import { S3Service } from "src/s3/s3.service";
import { lessons } from "src/storage/schema";

import {
  MAX_FILE_SIZE,
  ALLOWED_EXCEL_MIME_TYPES,
  ALLOWED_EXCEL_MIME_TYPES_MAP,
  ALLOWED_MIME_TYPES,
  MAX_VIDEO_SIZE,
} from "./file.constants";
import { FileGuard } from "./guards/file.guard";
import { VideoProcessingStateService } from "./video-processing-state.service";
import { VideoUploadNotificationGateway } from "./video-upload-notification.gateway";
import { VideoUploadQueueService } from "./video-upload-queue.service";

import type { FileValidationOptions } from "./guards/file.guard";
import type { BunnyWebhookBody } from "./schemas/bunny-webhook.schema";
import type { ExcelHyperlinkCell } from "./types/excel";
import type { VideoUploadState } from "./video-processing-state.service";
import type { Static, TSchema } from "@sinclair/typebox";

@Injectable()
export class FileService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly bunnyStreamService: BunnyStreamService,
    private readonly videoUploadQueueService: VideoUploadQueueService,
    private readonly videoProcessingStateService: VideoProcessingStateService,
    @Inject("DB") private readonly db: DatabasePg,
    @Inject("CACHE_MANAGER") private readonly cache: any,
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

  async uploadFile(file: Express.Multer.File, resource: string, lessonId?: string, options?: FileValidationOptions) {
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
        options ?? { allowedTypes: ALLOWED_MIME_TYPES, maxSize: isVideo ? MAX_VIDEO_SIZE : MAX_FILE_SIZE },
      );

      if (isVideo) {
        const uploadId = randomUUID();
        const placeholderKey = `processing-${resource}-${uploadId}`;
        const fileType = file.originalname?.split(".").pop();

        try {
          await this.videoProcessingStateService.initializeState(uploadId, placeholderKey, fileType);
        } catch (cacheError) {
          console.error("Cache initialization failed:", cacheError);
          throw new ConflictException("Cache service unavailable");
        }

        try {
          await this.videoUploadQueueService.enqueueVideoUpload(
            file,
            resource,
            uploadId,
            placeholderKey,
            fileType,
            lessonId,
          );
        } catch (queueError) {
          throw new ConflictException("Queue service unavailable");
        }

        // Return temporary response - video is being processed
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
    const workbook = new Excel.Workbook();

    const worksheet =
      file.mimetype === ALLOWED_EXCEL_MIME_TYPES_MAP.csv
        ? await workbook.csv.read(fileStream, {
            parserOptions: { delimiter: "," },
          })
        : await workbook.xlsx.read(fileStream).then(() => workbook.worksheets[0]);

    const allSheetValues = worksheet.getSheetValues();
    if (!allSheetValues || allSheetValues.length <= 1)
      throw new BadRequestException({ message: "files.import.fileEmpty" });

    const headers = (allSheetValues[1] as string[]).map((h) => String(h).trim().replace(/\r/, ""));
    const rows = allSheetValues.slice(2);

    const parsedCsvData = rows.map((rowValues) => {
      if (!Array.isArray(rowValues)) return;

      const parsedObject: Record<string, string> = {};

      headers.forEach((header, colIndex) => {
        const normalizedHeader = header.trim();

        const cellValue = rowValues[colIndex];

        if (cellValue && typeof cellValue === "object" && "hyperlink" in cellValue) {
          parsedObject[normalizedHeader] = String((cellValue as ExcelHyperlinkCell).hyperlink)
            .replace(/^mailto:/, "")
            .trim();

          return;
        }

        if (!isEmpty(cellValue)) parsedObject[normalizedHeader] = String(cellValue).trim();
      });

      if (isEmpty(parsedObject)) return null;

      if (!validator.Check(parsedObject))
        throw new BadRequestException({
          message: "files.import.requiredDataMissing",
        });

      return parsedObject as Static<T>;
    });

    return parsedCsvData.filter((item) => item !== null);
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

    console.log("Bunny webhook payload:", payload);
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

    // Get uploadId from videoId and send notification directly when status = 3
    const cacheKey = `video-upload:video:${videoId}`;
    const uploadId = (await this.cache.get(cacheKey)) as string | undefined;

    // Send notification directly when status = 3, if uploadId is found in cache
    if (uploadId) {
      await this.notificationGateway.publishNotification({
        uploadId,
        status: "processed",
        fileKey,
        fileUrl,
      });
    } else {
      throw new BadRequestException("No uploadId found in cache for videoId");
    }

    const state = await this.videoProcessingStateService.markProcessed(videoId, fileUrl);
    const lessonKey = state?.placeholderKey || fileKey;

    // If we have a lessonId from the state, update by lessonId (most reliable)
    if (state?.lessonId) {
      await this.db
        .update(lessons)
        .set({ fileS3Key: fileKey, fileType: state?.fileType ?? null })
        .where(eq(lessons.id, state.lessonId));

    } else {
      // Fallback to placeholder key OR by existing bunny video key
      await this.db
        .update(lessons)
        .set({ fileS3Key: fileKey, fileType: state?.fileType ?? null })
        .where(eq(lessons.fileS3Key, lessonKey));


      // Also try updating by bunny video key as fallback (in case lesson was already partially updated)
      await this.db
        .update(lessons)
        .set({ fileS3Key: fileKey, fileType: state?.fileType ?? null })
        .where(eq(lessons.fileS3Key, fileKey));

    }

    return { success: true };
  }
}
