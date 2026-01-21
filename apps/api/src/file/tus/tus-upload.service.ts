import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { VIDEO_PROVIDERS, ALLOWED_VIDEO_FILE_TYPES } from "@repo/shared";
import { CacheManagerStore } from "cache-manager";

import { S3Service } from "src/s3/s3.service";

import { MAX_VIDEO_SIZE } from "../file.constants";
import { FileGuard } from "../guards/file.guard";
import { VideoProcessingStateService } from "../video-processing-state.service";

type TusUploadState = {
  uploadId: string;
  fileKey: string;
  multipartUploadId: string;
  uploadLength: number;
  offset: number;
  parts: Array<{ ETag: string; PartNumber: number }>;
  placeholderKey: string;
  fileType?: string;
  userId?: string;
  sniffedMimeType?: string;
};

const TUS_STATE_TTL = 4 * 60 * 60 * 1000;
const MIN_S3_PART_SIZE = 5 * 1024 * 1024;

@Injectable()
export class TusUploadService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly videoProcessingStateService: VideoProcessingStateService,
    @Inject("CACHE_MANAGER") private readonly cache: CacheManagerStore,
  ) {}

  async createSession(uploadId: string, uploadLength: number, currentUserId?: string) {
    if (!uploadLength || uploadLength <= 0) {
      throw new BadRequestException("Missing upload length");
    }

    if (uploadLength > MAX_VIDEO_SIZE) {
      throw new BadRequestException("Video file exceeds maximum allowed size");
    }

    const state = await this.videoProcessingStateService.getState(uploadId);

    if (!state || state.provider !== VIDEO_PROVIDERS.S3 || !state.fileKey) {
      throw new BadRequestException("S3 video upload not initialized");
    }

    if (state.userId && currentUserId && state.userId !== currentUserId) {
      throw new ForbiddenException("Upload does not belong to the current user");
    }

    if (!state.multipartUploadId) {
      throw new BadRequestException("Missing multipart upload ID");
    }

    const existing = await this.getSession(uploadId);
    if (existing) return existing;

    const session: TusUploadState = {
      uploadId,
      fileKey: state.fileKey,
      multipartUploadId: state.multipartUploadId,
      uploadLength,
      offset: 0,
      parts: [],
      placeholderKey: state.placeholderKey,
      fileType: state.fileType,
      userId: state.userId,
    };

    await this.cache.set(this.getCacheKey(uploadId), session, TUS_STATE_TTL);

    return session;
  }

  async getSession(uploadId: string): Promise<TusUploadState | null> {
    const cached = (await this.cache.get(this.getCacheKey(uploadId))) as TusUploadState | undefined;
    return cached ?? null;
  }

  async handlePatch(uploadId: string, uploadOffset: number, chunk: Buffer, currentUserId?: string) {
    const session = await this.getSession(uploadId);

    if (!session) {
      throw new BadRequestException("Upload session not found");
    }

    if (session.userId && currentUserId && session.userId !== currentUserId) {
      throw new ForbiddenException("Upload does not belong to the current user");
    }

    if (uploadOffset !== session.offset) {
      return { offset: session.offset, conflict: true };
    }

    if (chunk.length === 0) {
      throw new BadRequestException("Empty upload chunk");
    }

    if (uploadOffset + chunk.length > session.uploadLength) {
      throw new BadRequestException("Upload exceeds declared length");
    }

    const isFinalChunk = uploadOffset + chunk.length === session.uploadLength;

    if (chunk.length < MIN_S3_PART_SIZE && !isFinalChunk) {
      throw new BadRequestException("Chunk is too small for multipart upload");
    }

    if (session.offset === 0 && chunk.length > 0) {
      const detectedType = await FileGuard.getFileType(
        chunk.subarray(0, Math.min(chunk.length, 512)),
      );

      if (!detectedType || !ALLOWED_VIDEO_FILE_TYPES.includes(detectedType?.mime))
        throw new BadRequestException("common.toast.somethingWentWrong");

      session.sniffedMimeType = detectedType?.mime;
    }

    const partNumber = session.parts.length + 1;

    const etag = await this.s3Service.uploadMultipartPart(
      session.fileKey,
      session.multipartUploadId,
      partNumber,
      chunk,
    );

    session.parts.push({ ETag: etag, PartNumber: partNumber });

    session.offset += chunk.length;

    if (session.offset === session.uploadLength) {
      await this.s3Service.completeMultipartUpload(
        session.fileKey,
        session.multipartUploadId,
        session.parts,
      );

      const fileUrl = await this.s3Service.getSignedUrl(session.fileKey);

      await this.videoProcessingStateService.markUploaded({
        uploadId: session.uploadId,
        fileKey: session.fileKey,
        fileUrl,
        placeholderKey: session.placeholderKey,
        fileType: session.fileType,
        provider: VIDEO_PROVIDERS.S3,
      });

      await this.cache.del(this.getCacheKey(uploadId));

      return { offset: session.offset, completed: true };
    }

    await this.cache.set(this.getCacheKey(uploadId), session, TUS_STATE_TTL);

    return { offset: session.offset, completed: false };
  }

  private getCacheKey(uploadId: string) {
    return `tus-upload:${uploadId}`;
  }
}
