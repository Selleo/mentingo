import { Inject, Injectable, Logger } from "@nestjs/common";

import { CACHE_MANAGER_TOKEN, type Cache } from "src/cache/cache.types";
import { S3Service } from "src/s3/s3.service";

import { getNativeArchiveExportPrefix } from "../native-archive-storage-paths";
import { NATIVE_ARCHIVE_EXPORT_REUSE_TTL_MS } from "../native-archive.constants";

import type { UUIDType } from "src/common";

/**
 * Remembers finished exports by the fingerprint of their content, so exporting an unchanged
 * course again copies the earlier zip inside storage instead of rebuilding it. Each job still
 * gets its own copy, which keeps the daily export cleanup per job.
 */
@Injectable()
export class NativeArchiveExportReuseService {
  private readonly logger = new Logger(NativeArchiveExportReuseService.name);

  constructor(
    private readonly s3Service: S3Service,
    @Inject(CACHE_MANAGER_TOKEN) private readonly cache: Cache,
  ) {}

  /** Copies a remembered export with this fingerprint to the target key; false when there is none to reuse. */
  async copyRememberedExport(
    tenantId: UUIDType,
    fingerprint: string,
    targetKey: string,
  ): Promise<boolean> {
    try {
      const rememberedKey = await this.cache.get<string>(
        this.getRememberedExportCacheKey(tenantId, fingerprint),
      );

      if (!rememberedKey || !rememberedKey.startsWith(getNativeArchiveExportPrefix(tenantId))) {
        return false;
      }

      if (!(await this.s3Service.getFileExists(rememberedKey))) return false;

      await this.s3Service.copyFile(rememberedKey, targetKey, "application/zip");

      return true;
    } catch (error) {
      this.logger.warn(
        `Could not reuse an earlier native archive export: ${
          error instanceof Error ? error.message : error
        }`,
      );

      return false;
    }
  }

  async rememberExport(tenantId: UUIDType, fingerprint: string, exportKey: string): Promise<void> {
    try {
      await this.cache.set(
        this.getRememberedExportCacheKey(tenantId, fingerprint),
        exportKey,
        NATIVE_ARCHIVE_EXPORT_REUSE_TTL_MS,
      );
    } catch (error) {
      this.logger.warn(
        `Could not remember a native archive export: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  private getRememberedExportCacheKey(tenantId: UUIDType, fingerprint: string): string {
    return `native-archive:export:${tenantId}:${fingerprint}`;
  }
}
