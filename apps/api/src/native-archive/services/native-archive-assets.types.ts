import type {
  NativeArchiveAsset,
  NativeArchiveProgressReporter,
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
  uploadedResourceIdsByFileKey: Map<string, UUIDType>;
  assetReferences: Set<string>;
  uploadedFileReferences: string[];
  uploadedS3Keys: string[];
  resourceIds: UUIDType[];
  progress: NativeArchiveProgressReporter;
  uploadWork: { completed: number; total: number };
};

export type NativeArchiveImageAssetGroup = {
  sourceBase: string;
  assets: NativeArchiveAsset[];
};

export type NativeArchiveAssetUpload = {
  asset: NativeArchiveAsset;
  targetReference: string;
  contentType: string;
  isLessonFile: boolean;
  isContentAddressed: boolean;
};
