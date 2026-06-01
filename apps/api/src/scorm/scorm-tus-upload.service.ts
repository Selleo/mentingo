import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { CACHE_MANAGER_TOKEN, Cache } from "src/cache/cache.types";
import { S3Service } from "src/s3/s3.service";

import { MAX_SCORM_PACKAGE_SIZE_BYTES } from "./scorm-package-limits";
import { SCORM_TUS_MIN_S3_PART_SIZE, SCORM_TUS_STATE_TTL } from "./scorm-tus-upload.constants";

import type {
  CreateScormTusUploadSessionParams,
  ScormTusUploadState,
} from "./scorm-tus-upload.types";
import type { UUIDType } from "src/common";

@Injectable()
export class ScormTusUploadService {
  constructor(
    private readonly s3Service: S3Service,
    @Inject(CACHE_MANAGER_TOKEN) private readonly cache: Cache,
  ) {}

  async createSession(params: CreateScormTusUploadSessionParams) {
    if (params.importRequest.sizeBytes > MAX_SCORM_PACKAGE_SIZE_BYTES) {
      throw new BadRequestException("adminScorm.errors.packageTooLarge");
    }

    const existing = await this.getSession(params.packageId);
    if (existing) return existing;

    const session: ScormTusUploadState = {
      packageId: params.packageId,
      uploadId: params.uploadId,
      stagedFileReference: params.stagedFileReference,
      multipartUploadId: params.multipartUploadId,
      uploadLength: params.importRequest.sizeBytes,
      offset: 0,
      parts: [],
      filename: params.importRequest.filename,
      mimeType: params.importRequest.mimeType,
      userId: params.currentUser.userId,
      tenantId: params.currentUser.tenantId,
      importRequest: params.importRequest,
      completed: false,
    };

    await this.cache.set(this.getCacheKey(params.packageId), session, SCORM_TUS_STATE_TTL);

    return session;
  }

  async getSession(packageId: UUIDType): Promise<ScormTusUploadState | null> {
    const cached = (await this.cache.get(this.getCacheKey(packageId))) as
      | ScormTusUploadState
      | undefined;
    return cached ?? null;
  }

  async handlePatch(
    packageId: UUIDType,
    uploadOffset: number,
    chunk: Buffer,
    currentUserId: UUIDType,
  ) {
    const session = await this.getOwnedSession(packageId, currentUserId);

    if (session.completed) {
      throw new BadRequestException("adminScorm.errors.uploadAlreadyCompleted");
    }

    if (uploadOffset !== session.offset) {
      return { offset: session.offset, conflict: true };
    }

    if (chunk.length === 0) {
      throw new BadRequestException("adminScorm.errors.emptyUploadChunk");
    }

    if (uploadOffset + chunk.length > session.uploadLength) {
      throw new BadRequestException("adminScorm.errors.uploadExceedsDeclaredLength");
    }

    const isFinalChunk = uploadOffset + chunk.length === session.uploadLength;

    if (chunk.length < SCORM_TUS_MIN_S3_PART_SIZE && !isFinalChunk) {
      throw new BadRequestException("adminScorm.errors.uploadChunkTooSmall");
    }

    const partNumber = session.parts.length + 1;
    const etag = await this.s3Service.uploadMultipartPart(
      session.stagedFileReference,
      session.multipartUploadId,
      partNumber,
      chunk,
    );

    session.parts.push({ ETag: etag, PartNumber: partNumber });
    session.offset += chunk.length;

    await this.cache.set(this.getCacheKey(packageId), session, SCORM_TUS_STATE_TTL);

    return { offset: session.offset, completed: session.offset === session.uploadLength };
  }

  async completeUpload(packageId: UUIDType, currentUserId: UUIDType) {
    const session = await this.getOwnedSession(packageId, currentUserId);

    if (session.offset !== session.uploadLength) {
      throw new BadRequestException("adminScorm.errors.uploadIncomplete");
    }

    if (!session.completed) {
      await this.s3Service.completeMultipartUpload(
        session.stagedFileReference,
        session.multipartUploadId,
        session.parts,
      );

      session.completed = true;
      await this.cache.set(this.getCacheKey(packageId), session, SCORM_TUS_STATE_TTL);
    }

    return session;
  }

  async clearSession(packageId: UUIDType) {
    await this.cache.del(this.getCacheKey(packageId));
  }

  private async getOwnedSession(packageId: UUIDType, currentUserId: UUIDType) {
    const session = await this.getSession(packageId);

    if (!session) {
      throw new BadRequestException("adminScorm.errors.uploadSessionNotFound");
    }

    if (session.userId !== currentUserId) {
      throw new ForbiddenException("adminScorm.errors.uploadForbidden");
    }

    return session;
  }

  private getCacheKey(packageId: UUIDType) {
    return `scorm-tus-upload:${packageId}`;
  }
}
