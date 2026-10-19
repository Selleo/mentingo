export const CONTENT_MARKETPLACE_ENV = {
  BASE_URL: "CONTENT_MARKETPLACE_BASE_URL",
  API_KEY: "CONTENT_MARKETPLACE_API_KEY",
} as const;

export const CONTENT_MARKETPLACE_CATALOG_LIMITS = {
  KEYWORD_MAX_LENGTH: 200,
  CATEGORY_MAX_LENGTH: 500,
  MAX_PAGE: 1_000_000,
  MAX_PAGE_SIZE: 100,
} as const;

export const CONTENT_MARKETPLACE_CATALOG_DEFAULTS = {
  PAGE: 1,
  PER_PAGE: 20,
} as const;

export const CONTENT_MARKETPLACE_THUMBNAIL_FALLBACK_CONTENT_TYPE = "application/octet-stream";

export const CONTENT_MARKETPLACE_IMPORT_SOURCE_KIND = "content-marketplace";

export const CONTENT_MARKETPLACE_EVENT_TYPES = {
  COURSE_COPIED: "course_copied",
  COURSE_DUPLICATED: "course_duplicated",
} as const;

export const CONTENT_MARKETPLACE_COPY_STATUSES = {
  IMPORTED: "imported",
  FAILED: "failed",
} as const;

export const CONTENT_MARKETPLACE_EVENT_DELIVERY = {
  JOB_NAME: "deliver-content-marketplace-event",
  ATTEMPTS: 8,
  BACKOFF_DELAY_MS: 10_000,
  CONCURRENCY: 2,
} as const;

export const CONTENT_MARKETPLACE_ERRORS = {
  UNAVAILABLE: "contentMarketplace.error.unavailable",
  LISTING_NOT_FOUND: "contentMarketplace.error.listingNotFound",
  THUMBNAIL_NOT_FOUND: "contentMarketplace.error.thumbnailNotFound",
  SERVICE_ERROR: "contentMarketplace.error.serviceError",
} as const;
