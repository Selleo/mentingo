import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import type { UserRole } from "~/config/userRoles";

// The standard db:seed adds the localhost suffix for this isolated recording origin.
export const RECORDING_ORIGIN = "https://localhost:5173";
export const RECORDING_ACCOUNTS: Record<UserRole, string> = {
  [SYSTEM_ROLE_SLUGS.ADMIN]: "admin+localhost@example.com",
  [SYSTEM_ROLE_SLUGS.STUDENT]: "student+localhost@example.com",
  [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]: "contentcreator+localhost@example.com",
};
