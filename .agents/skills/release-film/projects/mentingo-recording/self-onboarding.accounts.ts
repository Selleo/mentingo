import { getSelfOnboardingDemoEmail, SYSTEM_ROLE_SLUGS } from "@repo/shared";

import type { UserRole } from "~/config/userRoles";

/** The tutorial opt-in seed has fictional named people, shared with its browser fixture. */
export const RECORDING_ORIGIN = "https://localhost:5173";
export const RECORDING_ACCOUNTS: Record<UserRole, string> = {
  [SYSTEM_ROLE_SLUGS.ADMIN]: getSelfOnboardingDemoEmail(SYSTEM_ROLE_SLUGS.ADMIN, RECORDING_ORIGIN),
  [SYSTEM_ROLE_SLUGS.STUDENT]: getSelfOnboardingDemoEmail(SYSTEM_ROLE_SLUGS.STUDENT, RECORDING_ORIGIN),
  [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]: getSelfOnboardingDemoEmail(
    SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
    RECORDING_ORIGIN,
  ),
};
