import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

export const DIRECTORY_SYNC_SEED_CREATOR_EMAIL = "admin@example.com";

export const DIRECTORY_SYNC_SEED_ROLE_MAPPINGS = [
  { externalGroupId: "fake-group-lms-admins", roleSlug: SYSTEM_ROLE_SLUGS.ADMIN },
  { externalGroupId: "fake-group-engineers", roleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR },
] as const;

export const DIRECTORY_SYNC_SEED_GROUP_MAPPING_EXTERNAL_IDS = ["fake-group-sales-team"] as const;
