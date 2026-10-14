import {
  type PermissionKey,
  PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  FEATURES,
  FEATURE_SETTINGS_KEYS,
} from "@repo/shared";

import type { CurrentUserType } from "src/common/types/current-user.type";
import type { SettingsService } from "src/settings/settings.service";

type Settings = Awaited<ReturnType<SettingsService["getGlobalSettings"]>>;

export const MCP_STUDENT_SEARCH_PERMISSIONS = [
  PERMISSIONS.COURSE_READ,
  PERMISSIONS.COURSE_READ_ASSIGNED,
  PERMISSIONS.ARTICLE_READ_PUBLIC,
  PERMISSIONS.NEWS_READ_PUBLIC,
  PERMISSIONS.QA_READ_PUBLIC,
];

/** Intersection with the account's current access, never an impersonated student identity. */
export function asMcpStudentUser(user: CurrentUserType, settings?: Settings): CurrentUserType {
  const allowed = new Set<PermissionKey>(SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_SLUGS.STUDENT]);
  if (settings) {
    for (const [feature, permission] of [
      [FEATURES.ARTICLES, PERMISSIONS.ARTICLE_READ_PUBLIC],
      [FEATURES.NEWS, PERMISSIONS.NEWS_READ_PUBLIC],
      [FEATURES.QA, PERMISSIONS.QA_READ_PUBLIC],
    ] as const) {
      if (!settings[FEATURE_SETTINGS_KEYS[feature]]) allowed.delete(permission);
    }
  }
  return {
    ...user,
    permissions: user.permissions.filter((permission) => allowed.has(permission)),
    roleSlugs: user.roleSlugs.filter((role) => role === SYSTEM_ROLE_SLUGS.STUDENT),
  };
}

/** Per-resource management permissions, independent of role names. */
export function hasMcpManagementSearchAccess(permissions: PermissionKey[]): boolean {
  const managementPermissions: PermissionKey[] = [
    PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.COURSE_UPDATE_OWN,
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.NEWS_MANAGE_OWN,
    PERMISSIONS.ARTICLE_MANAGE,
    PERMISSIONS.ARTICLE_MANAGE_OWN,
    PERMISSIONS.QA_MANAGE,
    PERMISSIONS.QA_MANAGE_OWN,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.CATEGORY_MANAGE,
    PERMISSIONS.GROUP_MANAGE,
    PERMISSIONS.LEARNING_PATH_UPDATE,
    PERMISSIONS.LEARNING_PATH_UPDATE_OWN,
  ];
  return permissions.some((permission) => managementPermissions.includes(permission));
}
