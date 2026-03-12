import {
  SYSTEM_ROLE_SLUGS,
  SYSTEM_ROLE_SLUG_VALUES,
  type SystemRoleSlug,
} from "src/permission/permission.constants";

export const userRoles = SYSTEM_ROLE_SLUG_VALUES;

// Backward-compatible alias kept temporarily during migration.
export const USER_ROLES = SYSTEM_ROLE_SLUGS;

export type UserRole = SystemRoleSlug;
