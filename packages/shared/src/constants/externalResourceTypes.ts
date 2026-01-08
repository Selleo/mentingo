export const EXTERNAL_RESOURCE_TYPE = {
  PRESENTATION: "presentation",
  VIDEO: "video",
} as const;

export type ExternalResourceType =
  (typeof EXTERNAL_RESOURCE_TYPE)[keyof typeof EXTERNAL_RESOURCE_TYPE];


