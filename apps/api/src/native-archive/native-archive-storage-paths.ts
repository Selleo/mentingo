import { prefixTenantStorageKey } from "src/file/utils/tenantStorageKey";

import type { UUIDType } from "src/common";

const NATIVE_ARCHIVE_ROOT = "native-archive";

export function getNativeArchiveUploadPrefix(tenantId: UUIDType): string {
  return prefixTenantStorageKey(`${NATIVE_ARCHIVE_ROOT}/uploads/`, tenantId);
}

export function getNativeArchiveUploadKey(tenantId: UUIDType, uploadId: UUIDType): string {
  return `${getNativeArchiveUploadPrefix(tenantId)}${uploadId}.zip`;
}

export function getNativeArchiveExportPrefix(tenantId: UUIDType): string {
  return prefixTenantStorageKey(`${NATIVE_ARCHIVE_ROOT}/exports/`, tenantId);
}

export function getNativeArchiveExportKey(tenantId: UUIDType, exportId: UUIDType): string {
  return `${getNativeArchiveExportPrefix(tenantId)}${exportId}.zip`;
}

export function getNativeArchiveImportPrefix(tenantId: UUIDType, importId: UUIDType): string {
  return prefixTenantStorageKey(`${NATIVE_ARCHIVE_ROOT}/imports/${importId}`, tenantId);
}
