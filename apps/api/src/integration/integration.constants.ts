import { IMAGE_QUALITY } from "src/file/image-variants/image-variant.constants";

export const INTEGRATION_TENANT_API_KEYS = {
  LUMA_API_KEY: "LUMA_API_KEY",
} as const;

export type IntegrationTenantApiKey =
  (typeof INTEGRATION_TENANT_API_KEYS)[keyof typeof INTEGRATION_TENANT_API_KEYS];

export const INTEGRATION_COURSES_MAX_PAGE_SIZE = 100;

export const INTEGRATION_COURSE_THUMBNAIL_QUALITY = IMAGE_QUALITY.SM;

/** A page and its total count are read from one snapshot, so they agree with each other. */
export const INTEGRATION_COURSE_CATALOG_TRANSACTION = {
  isolationLevel: "repeatable read",
  accessMode: "read only",
} as const;
