import path from "node:path";

import { IMAGE_QUALITY } from "src/file/image-variants/image-variant.constants";
import {
  getImageVariantKey,
  isImageVariantReference,
  isSupportedImageVariantMimeType,
} from "src/file/image-variants/image-variant.utils";

import type { ImageQuality } from "src/file/image-variants/image-variant.types";

const SOURCE_QUALITY_ORDER: ImageQuality[] = [
  IMAGE_QUALITY.XL,
  IMAGE_QUALITY.LG,
  IMAGE_QUALITY.MD,
  IMAGE_QUALITY.SM,
  IMAGE_QUALITY.XS,
  IMAGE_QUALITY.XXS,
];

export const IMAGE_MIGRATION_SKIP_REASON = {
  EMPTY: "empty",
  REMOTE_URL: "remote_url",
  BUNNY_VIDEO: "bunny_video",
  UNSUPPORTED_MIME_TYPE: "unsupported_mime_type",
} as const;

export type ImageMigrationSkipReason =
  (typeof IMAGE_MIGRATION_SKIP_REASON)[keyof typeof IMAGE_MIGRATION_SKIP_REASON];

export const getReferenceSkipReason = (reference: string | null | undefined) => {
  if (!reference) return IMAGE_MIGRATION_SKIP_REASON.EMPTY;
  if (reference.startsWith("http://") || reference.startsWith("https://")) {
    return IMAGE_MIGRATION_SKIP_REASON.REMOTE_URL;
  }
  if (reference.startsWith("bunny-")) return IMAGE_MIGRATION_SKIP_REASON.BUNNY_VIDEO;
  return null;
};

export const getMimeTypeSkipReason = (mimeType: string | null | undefined) => {
  if (!mimeType) return null;
  if (isSupportedImageVariantMimeType(mimeType)) return null;
  return IMAGE_MIGRATION_SKIP_REASON.UNSUPPORTED_MIME_TYPE;
};

export const getVariantSourceKeys = (reference: string) =>
  SOURCE_QUALITY_ORDER.map((quality) => getImageVariantKey(reference, quality));

export const selectBestExistingVariantSourceKey = (
  reference: string,
  existingKeys: ReadonlySet<string>,
) => getVariantSourceKeys(reference).find((key) => existingKeys.has(key)) ?? null;

export const hasAllVariantKeys = (reference: string, existingKeys: ReadonlySet<string>) =>
  getVariantSourceKeys(reference).every((key) => existingKeys.has(key));

export const getResourceFolderFromReference = (reference: string, tenantId: string) => {
  const referenceWithoutTenant = reference.startsWith(`${tenantId}/`)
    ? reference.slice(tenantId.length + 1)
    : reference;

  const dirname = path.posix.dirname(referenceWithoutTenant);
  if (!dirname || dirname === ".") return "image-variants-migration";
  if (!isImageVariantReference(referenceWithoutTenant)) return dirname;

  const variantsIndex = dirname.indexOf("/variants");
  if (variantsIndex === -1) return dirname;

  const resourceFolder = dirname.slice(0, variantsIndex);
  return resourceFolder || "image-variants-migration";
};
