import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import type { TFunction } from "i18next";
import type { RoleOption } from "~/api/queries/admin/useRoles";

const SYSTEM_ROLE_TRANSLATION_KEYS = {
  [SYSTEM_ROLE_SLUGS.ADMIN]: "common.roles.admin",
  [SYSTEM_ROLE_SLUGS.STUDENT]: "common.roles.student",
  [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]: "common.roles.contentCreator",
} as const;

export const getRoleLabel = (roleSlug: string, t: TFunction, roles?: RoleOption[]): string => {
  const role = roles?.find((item) => item.slug === roleSlug);
  const translationKey =
    SYSTEM_ROLE_TRANSLATION_KEYS[roleSlug as keyof typeof SYSTEM_ROLE_TRANSLATION_KEYS];

  if (role?.isSystem && translationKey) {
    return t(translationKey);
  }

  return role?.name || roleSlug;
};
