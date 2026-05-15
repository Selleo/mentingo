import type { ResourceLibraryAssetType } from "./schemas/resource-library.schema";
import type { UUIDType } from "src/common";

export type AssetRecord = {
  id: UUIDType;
  fileName: string;
  title: string;
  contentType: string;
  type: ResourceLibraryAssetType;
  size: number | null;
  originalFilename: string | null;
  reference: string;
  uploadedBy: UUIDType | null;
  createdAt: string;
  usageCount: number;
};
