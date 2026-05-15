export const RESOURCE_LIBRARY_ASSET_TYPE = {
  IMAGE: "image",
  VIDEO: "video",
  PDF: "pdf",
  PRESENTATION: "presentation",
  DOCUMENT: "document",
  OTHER: "other",
} as const;

export type ResourceLibraryAssetType =
  (typeof RESOURCE_LIBRARY_ASSET_TYPE)[keyof typeof RESOURCE_LIBRARY_ASSET_TYPE];
