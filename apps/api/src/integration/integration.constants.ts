import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { IMAGE_QUALITY } from "src/file/image-variants/image-variant.constants";

export const INTEGRATION_TENANT_API_KEYS = {
  LUMA_API_KEY: "LUMA_API_KEY",
} as const;

export type IntegrationTenantApiKey =
  (typeof INTEGRATION_TENANT_API_KEYS)[keyof typeof INTEGRATION_TENANT_API_KEYS];

export const PHISHING_PLUGIN_ENV_NAMES = [
  "PHISHING_BASE_URL",
  "PHISHING_API_KEY",
  "PHISHING_WEBHOOK_SECRET",
] as const;

export const COMPETENCIES_PLUGIN_ENV_NAMES = [
  "COMPETENCIES_BASE_URL",
  "COMPETENCIES_API_KEY",
] as const;

/** Every integration API key acts with the system admin role, regardless of its creator's role. */
export const INTEGRATION_KEY_ROLE_SLUG = SYSTEM_ROLE_SLUGS.ADMIN;

export const INTEGRATION_COURSES_MAX_PAGE_SIZE = 100;

export const INTEGRATION_COURSE_THUMBNAIL_QUALITY = IMAGE_QUALITY.SM;

/** A page and its total count are read from one snapshot, so they agree with each other. */
export const INTEGRATION_COURSE_CATALOG_TRANSACTION = {
  isolationLevel: "repeatable read",
  accessMode: "read only",
} as const;
