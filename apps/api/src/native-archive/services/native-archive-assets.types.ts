import type {
  NativeArchiveAsset,
  NativeArchiveScormAssetDirectory,
  ParsedNativeArchive,
} from "../native-archive.types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

export type NativeArchiveAssetStagingContext = {
  archive: ParsedNativeArchive;
  actor: CurrentUserType;
  importPrefix: string;
  scormDirectories: NativeArchiveScormAssetDirectory[];
  referenceMap: Map<string, string>;
  assetReferences: Set<string>;
  uploadedFileReferences: string[];
  uploadedS3Keys: string[];
  resourceIds: UUIDType[];
};

export type NativeArchiveImageAssetGroup = {
  sourceBase: string;
  assets: NativeArchiveAsset[];
};
