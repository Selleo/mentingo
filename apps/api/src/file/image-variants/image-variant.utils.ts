import { randomUUID } from "crypto";
import path from "node:path";

import { prefixTenantStorageKey } from "src/file/utils/tenantStorageKey";

import {
  IMAGE_QUALITY,
  IMAGE_VARIANT_DEFINITIONS,
  IMAGE_VARIANT_CONTENT_TYPE,
  SUPPORTED_IMAGE_VARIANT_MIME_TYPE_SET,
} from "./image-variant.constants";

import type { ImageQuality, SupportedImageVariantMimeType } from "./image-variant.types";
import type { UUIDType } from "src/common";

export const isSupportedImageVariantMimeType = (
  mimeType: string,
): mimeType is SupportedImageVariantMimeType => SUPPORTED_IMAGE_VARIANT_MIME_TYPE_SET.has(mimeType);

export const isImageVariantReference = (reference: string) => reference.includes("/variants/");

export const buildImageVariantReferenceKey = (resource: string, tenantId: UUIDType) =>
  prefixTenantStorageKey(`${resource}/variants/${randomUUID()}.webp`, tenantId);

export const getImageVariantKey = (reference: string, quality: ImageQuality) => {
  if (!isImageVariantReference(reference)) return reference;

  const extension = path.extname(reference);
  if (!extension) return `${reference}-${quality}`;

  return `${reference.slice(0, -extension.length)}-${quality}${extension}`;
};

export const getAllImageVariantKeys = (reference: string) =>
  IMAGE_VARIANT_DEFINITIONS.map(({ quality }) => getImageVariantKey(reference, quality));

export const getDefaultImageQuality = (): ImageQuality => IMAGE_QUALITY.HIGH;

export const getImageVariantContentType = () => IMAGE_VARIANT_CONTENT_TYPE;
