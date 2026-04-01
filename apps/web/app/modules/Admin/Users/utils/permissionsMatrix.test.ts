import { PERMISSIONS, SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { buildPermissionMatrix, buildPermissionsUnionForRoleSlugs } from "./permissionsMatrix";

import type { PermissionKey } from "@repo/shared";

const permissionsOrder = Object.values(PERMISSIONS) as PermissionKey[];

describe("permissionsMatrix utils", () => {
  it("builds matrix rows for role grants", () => {
    const rows = buildPermissionMatrix({
      permissionsOrder: [PERMISSIONS.USER_MANAGE, PERMISSIONS.USER_READ_SELF],
      roles: [
        {
          slug: SYSTEM_ROLE_SLUGS.ADMIN,
          label: "Admin",
          permissions: SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_SLUGS.ADMIN],
        },
        {
          slug: SYSTEM_ROLE_SLUGS.STUDENT,
          label: "Student",
          permissions: SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_SLUGS.STUDENT],
        },
      ],
    });

    expect(rows).toEqual([
      {
        permission: PERMISSIONS.USER_MANAGE,
        grants: {
          [SYSTEM_ROLE_SLUGS.ADMIN]: true,
          [SYSTEM_ROLE_SLUGS.STUDENT]: false,
        },
      },
      {
        permission: PERMISSIONS.USER_READ_SELF,
        grants: {
          [SYSTEM_ROLE_SLUGS.ADMIN]: true,
          [SYSTEM_ROLE_SLUGS.STUDENT]: true,
        },
      },
    ]);
  });

  it("builds role-slug union and ignores unknown role slugs", () => {
    const union = buildPermissionsUnionForRoleSlugs({
      roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT, "unknown-role", SYSTEM_ROLE_SLUGS.CONTENT_CREATOR],
      permissionsByRoleSlug: SYSTEM_ROLE_PERMISSIONS,
      permissionsOrder,
    });

    expect(union).toContain(PERMISSIONS.LEARNING_MODE_USE);
    expect(union).toContain(PERMISSIONS.QA_READ_PUBLIC);
    expect(union).not.toContain(PERMISSIONS.USER_MANAGE);
  });
});
