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

export const RESOURCE_VISIBILITY = {
  PUBLIC: "public",
  PRIVATE: "private",
  HIDDEN: "hidden",
} as const;

export type ResourceVisibility = (typeof RESOURCE_VISIBILITY)[keyof typeof RESOURCE_VISIBILITY];

export type EditableResourceVisibility = Exclude<
  ResourceVisibility,
  typeof RESOURCE_VISIBILITY.HIDDEN
>;
