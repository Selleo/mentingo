import { resolveScormContentTypeFromFilename } from "src/scorm/scorm-content-type";

import type { NativeArchiveAsset } from "./native-archive.types";

const DEFAULT_CONTENT_TYPE = "application/octet-stream";
const SAFE_ASSET_CONTENT_TYPES = new Set([
  DEFAULT_CONTENT_TYPE,
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "video/mp4",
  "video/quicktime",
]);

export function resolveImportedAssetContentType(
  asset: Pick<NativeArchiveAsset, "sourceReference" | "contentType">,
  isScormAsset: boolean,
): string {
  if (isScormAsset) {
    return resolveScormContentTypeFromFilename(asset.sourceReference, DEFAULT_CONTENT_TYPE);
  }

  const contentType = asset.contentType.trim().toLowerCase();
  return SAFE_ASSET_CONTENT_TYPES.has(contentType) ? contentType : DEFAULT_CONTENT_TYPE;
}
