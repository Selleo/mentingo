import { prefixTenantStorageKey } from "./tenantStorageKey";

import type { UUIDType } from "src/common";

export const BASE_THUMBNAIL_EXTENSION = ".jpeg";
export const BASE_THUMBNAIL_CONTENT_TYPE = "image/jpeg";

export const getVideoThumbnailFilename = (resourceId: UUIDType) =>
  `${resourceId}${BASE_THUMBNAIL_EXTENSION}`;
export const getVideoThumbnailKey = (resourceId: UUIDType, tenantId?: UUIDType) =>
  prefixTenantStorageKey(`thumbnail/${getVideoThumbnailFilename(resourceId)}`, tenantId);
