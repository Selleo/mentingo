import { ALLOWED_VIDEO_FILE_TYPES, RESOURCE_LIBRARY_ASSET_TYPE } from "@repo/shared";
import {
  Archive,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Image,
} from "lucide-react";

import { RICH_TEXT_RESOURCE_TYPE } from "~/hooks/useEntityResourceUpload";

import type { ResourceLibraryAsset } from "~/api/queries/useResourceLibraryAssets";

export const getAssetDisplayName = (asset: ResourceLibraryAsset) =>
  asset.title || asset.fileName || asset.originalFilename || asset.reference;

export const formatAssetSize = (bytes: number | null) => {
  if (!bytes) return null;

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

export const isAssetLibraryVideoFile = (file: File) => ALLOWED_VIDEO_FILE_TYPES.includes(file.type);

export const getRichTextResourceTypeFromAsset = (asset: ResourceLibraryAsset) => {
  if (asset.type === RESOURCE_LIBRARY_ASSET_TYPE.VIDEO) return RICH_TEXT_RESOURCE_TYPE.VIDEO;
  if (asset.type === RESOURCE_LIBRARY_ASSET_TYPE.PRESENTATION) {
    return RICH_TEXT_RESOURCE_TYPE.PRESENTATION;
  }
  if (asset.type === RESOURCE_LIBRARY_ASSET_TYPE.PDF) return RICH_TEXT_RESOURCE_TYPE.PDF;
  if (asset.type === RESOURCE_LIBRARY_ASSET_TYPE.DOCUMENT) return RICH_TEXT_RESOURCE_TYPE.DOCUMENT;
  return RICH_TEXT_RESOURCE_TYPE.OTHER;
};

export const richTextResourceTypeNeedsDisplayMode = (
  type: ReturnType<typeof getRichTextResourceTypeFromAsset>,
) => type === RICH_TEXT_RESOURCE_TYPE.PRESENTATION || type === RICH_TEXT_RESOURCE_TYPE.PDF;

export const AssetTypeIcon = ({ type }: { type: ResourceLibraryAsset["type"] }) => {
  const className = "size-5 text-neutral-700";

  if (type === RESOURCE_LIBRARY_ASSET_TYPE.IMAGE)
    return <Image className={className} aria-hidden />;
  if (type === RESOURCE_LIBRARY_ASSET_TYPE.VIDEO) {
    return <FileVideo className={className} aria-hidden />;
  }
  if (type === RESOURCE_LIBRARY_ASSET_TYPE.PDF) {
    return <FileText className={className} aria-hidden />;
  }
  if (type === RESOURCE_LIBRARY_ASSET_TYPE.PRESENTATION) {
    return <Archive className={className} aria-hidden />;
  }
  if (type === RESOURCE_LIBRARY_ASSET_TYPE.DOCUMENT) {
    return <FileSpreadsheet className={className} aria-hidden />;
  }
  return <FileIcon className={className} aria-hidden />;
};
