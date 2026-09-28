import { randomUUID } from "node:crypto";

import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { DEFAULT_TUS_CHUNK_SIZE } from "@repo/shared";
import { validate as isUuid } from "uuid";

import { CACHE_MANAGER_TOKEN, type Cache } from "src/cache/cache.types";
import { FileGuard } from "src/file/guards/file.guard";
import { S3Service } from "src/s3/s3.service";

import { NATIVE_ARCHIVE_LIMITS } from "../native-archive.constants";

import type {
  NativeArchiveTusPatchResult,
  NativeArchiveTusSession,
  NativeArchiveUploadState,
} from "../native-archive.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class NativeArchiveTusService {
  constructor(
    private readonly s3Service: S3Service,
    @Inject(CACHE_MANAGER_TOKEN) private readonly cache: Cache,
  ) {}

  async createImportUploadSession(
    length: number,
    actor: CurrentUserType,
  ): Promise<NativeArchiveTusSession> {
    if (!this.s3Service.isConfigured()) {
      throw new BadRequestException("nativeArchive.error.storageUnavailable");
    }

    if (
      !Number.isSafeInteger(length) ||
      length < 1 ||
      length > NATIVE_ARCHIVE_LIMITS.MAX_ARCHIVE_BYTES
    ) {
      throw new BadRequestException("nativeArchive.error.archiveTooLarge");
    }

    const id = randomUUID();
    const key = `native-archive/uploads/${actor.tenantId}/${id}.zip`;
    const { uploadId: multipartId } = await this.s3Service.createMultipartUpload(
      key,
      "application/zip",
    );

    const state: NativeArchiveUploadState = {
      id,
      key,
      multipartId,
      tenantId: actor.tenantId,
      userId: actor.userId,
      length,
      offset: 0,
      completed: false,
      parts: [],
    };

    try {
      await this.saveImportUploadSession(state);
    } catch (error) {
      await this.s3Service.abortMultipartUpload(key, multipartId).catch(() => undefined);

      throw error;
    }

    return {
      uploadId: id,
      tusEndpoint: "/api/native-archives/tus",
      tusHeaders: {},
      expiresAt: new Date(Date.now() + NATIVE_ARCHIVE_LIMITS.SESSION_TTL_MS).toISOString(),
      partSize: DEFAULT_TUS_CHUNK_SIZE,
    };
  }

  async getImportUploadSession(
    id: string,
    actor: CurrentUserType,
  ): Promise<NativeArchiveUploadState> {
    if (!isUuid(id)) throw new BadRequestException("nativeArchive.error.uploadNotFound");

    const state = await this.cache.get<NativeArchiveUploadState>(`native-archive:tus:${id}`);

    if (!state) throw new BadRequestException("nativeArchive.error.uploadNotFound");

    if (state.userId !== actor.userId || state.tenantId !== actor.tenantId) {
      throw new ForbiddenException("nativeArchive.error.accessDenied");
    }

    return state;
  }

  async uploadImportChunk(
    id: string,
    offset: number,
    bytes: Buffer,
    actor: CurrentUserType,
  ): Promise<NativeArchiveTusPatchResult> {
    const state = await this.getImportUploadSession(id, actor);

    if (offset !== state.offset) return { offset: state.offset, conflict: true };

    if (state.completed) throw new BadRequestException("nativeArchive.error.uploadComplete");

    this.assertValidChunk(state, bytes);
    if (state.offset === 0) await this.assertZipFileType(bytes);

    await this.uploadMultipartPart(state, bytes);

    await this.saveImportUploadSession(state);
    if (state.offset === state.length) await this.finalizeMultipartUpload(state);

    return { offset: state.offset, conflict: false };
  }

  private assertValidChunk(state: NativeArchiveUploadState, bytes: Buffer): void {
    if (!bytes.length || state.offset + bytes.length > state.length) {
      throw new BadRequestException("nativeArchive.error.invalidUploadChunk");
    }

    const isFinalChunk = state.offset + bytes.length === state.length;
    if (bytes.length < NATIVE_ARCHIVE_LIMITS.MIN_PART_BYTES && !isFinalChunk) {
      throw new BadRequestException("nativeArchive.error.invalidUploadChunk");
    }
  }

  private async assertZipFileType(bytes: Buffer): Promise<void> {
    const detectedType = await FileGuard.getFileType(
      bytes.subarray(0, Math.min(bytes.length, 512)),
    );

    if (detectedType?.mime !== "application/zip") {
      throw new BadRequestException("nativeArchive.error.invalidUploadChunk");
    }
  }

  private async uploadMultipartPart(state: NativeArchiveUploadState, bytes: Buffer): Promise<void> {
    const partNumber = state.parts.length + 1;
    const etag = await this.s3Service.uploadMultipartPart(
      state.key,
      state.multipartId,
      partNumber,
      bytes,
    );

    state.parts.push({ ETag: etag, PartNumber: partNumber });
    state.offset += bytes.length;
  }

  async completeImportUpload(id: string, actor: CurrentUserType): Promise<string> {
    const state = await this.getImportUploadSession(id, actor);

    await this.finalizeMultipartUpload(state);

    return state.key;
  }

  private async finalizeMultipartUpload(state: NativeArchiveUploadState): Promise<void> {
    if (state.offset !== state.length) {
      throw new BadRequestException("nativeArchive.error.uploadIncomplete");
    }

    if (!state.completed) {
      await this.s3Service.completeMultipartUpload(state.key, state.multipartId, state.parts);
      state.completed = true;

      await this.saveImportUploadSession(state);
    }
  }

  async deleteImportUploadSession(id: string): Promise<void> {
    await this.cache.del(`native-archive:tus:${id}`);
  }

  private async saveImportUploadSession(state: NativeArchiveUploadState): Promise<void> {
    await this.cache.set(
      `native-archive:tus:${state.id}`,
      state,
      NATIVE_ARCHIVE_LIMITS.SESSION_TTL_MS,
    );
  }
}
