import { ALLOWED_VIDEO_FILE_TYPES, RESOURCE_LIBRARY_ASSET_TYPE } from "@repo/shared";
import {
  Archive,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Image,
} from "lucide-react";
import { match } from "ts-pattern";

import { RICH_TEXT_RESOURCE_TYPE } from "~/components/RichText/utils/richTextResource.types";

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

export const getRichTextResourceTypeFromAsset = (asset: ResourceLibraryAsset) =>
  match(asset.type)
    .with(RESOURCE_LIBRARY_ASSET_TYPE.IMAGE, () => RICH_TEXT_RESOURCE_TYPE.IMAGE)
    .with(RESOURCE_LIBRARY_ASSET_TYPE.VIDEO, () => RICH_TEXT_RESOURCE_TYPE.VIDEO)
    .with(RESOURCE_LIBRARY_ASSET_TYPE.PRESENTATION, () => RICH_TEXT_RESOURCE_TYPE.PRESENTATION)
    .with(RESOURCE_LIBRARY_ASSET_TYPE.PDF, () => RICH_TEXT_RESOURCE_TYPE.PDF)
    .with(RESOURCE_LIBRARY_ASSET_TYPE.DOCUMENT, () => RICH_TEXT_RESOURCE_TYPE.DOCUMENT)
    .otherwise(() => RICH_TEXT_RESOURCE_TYPE.OTHER);

export const richTextResourceTypeNeedsDisplayMode = (
  type: ReturnType<typeof getRichTextResourceTypeFromAsset>,
) => type === RICH_TEXT_RESOURCE_TYPE.PRESENTATION || type === RICH_TEXT_RESOURCE_TYPE.PDF;

export const AssetTypeIcon = ({ type }: { type: ResourceLibraryAsset["type"] }) => {
  const className = "size-5 text-neutral-700";

  return match(type)
    .with(RESOURCE_LIBRARY_ASSET_TYPE.IMAGE, () => <Image className={className} aria-hidden />)
    .with(RESOURCE_LIBRARY_ASSET_TYPE.VIDEO, () => <FileVideo className={className} aria-hidden />)
    .with(RESOURCE_LIBRARY_ASSET_TYPE.PDF, () => <FileText className={className} aria-hidden />)
    .with(RESOURCE_LIBRARY_ASSET_TYPE.PRESENTATION, () => (
      <Archive className={className} aria-hidden />
    ))
    .with(RESOURCE_LIBRARY_ASSET_TYPE.DOCUMENT, () => (
      <FileSpreadsheet className={className} aria-hidden />
    ))
    .otherwise(() => <FileIcon className={className} aria-hidden />);
};
