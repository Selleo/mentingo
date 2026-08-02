import { PERMISSIONS, SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { describe, expect, it } from "vitest";

import cs from "~/locales/cs/translation.json";
import de from "~/locales/de/translation.json";
import en from "~/locales/en/translation.json";
import es from "~/locales/es/translation.json";
import fr from "~/locales/fr/translation.json";
import lt from "~/locales/lt/translation.json";
import pl from "~/locales/pl/translation.json";

import { buildPermissionMatrix, buildPermissionsUnionForRoleSlugs } from "./permissionsMatrix";

import type { PermissionKey } from "@repo/shared";

const permissionsOrder = Object.values(PERMISSIONS) as PermissionKey[];
const translationsByLocale = { cs, de, en, es, fr, lt, pl };

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

  it("matches system-role grants to content read behavior", () => {
    const contentCreatorPermissions = SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_SLUGS.CONTENT_CREATOR];
    const studentPermissions = SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_SLUGS.STUDENT];
    const trainerPermissions = SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_SLUGS.TRAINER];

    expect(contentCreatorPermissions).not.toContain(PERMISSIONS.QA_MANAGE);
    expect(contentCreatorPermissions).toContain(PERMISSIONS.QA_MANAGE_OWN);
    expect(studentPermissions).toEqual(
      expect.arrayContaining([
        PERMISSIONS.NEWS_READ_PUBLIC,
        PERMISSIONS.ARTICLE_READ_PUBLIC,
        PERMISSIONS.QA_READ_PUBLIC,
      ]),
    );
    expect(trainerPermissions).not.toContain(PERMISSIONS.NEWS_READ_PUBLIC);
    expect(trainerPermissions).not.toContain(PERMISSIONS.ARTICLE_READ_PUBLIC);
    expect(trainerPermissions).not.toContain(PERMISSIONS.QA_READ_PUBLIC);
  });

  it("hides reserved permissions that do not have user-facing behavior yet", () => {
    const rows = buildPermissionMatrix({
      permissionsOrder,
      roles: [
        {
          slug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
          label: "Content Creator",
          permissions: SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_SLUGS.CONTENT_CREATOR],
        },
      ],
    });

    const renderedPermissions = rows.map((row) => row.permission);

    expect(renderedPermissions).not.toContain(PERMISSIONS.FILE_UPLOAD);
    expect(renderedPermissions).not.toContain(PERMISSIONS.FILE_DELETE);
    expect(renderedPermissions).not.toContain(PERMISSIONS.QA_MANAGE_OWN);
  });

  it.each(Object.entries(translationsByLocale))(
    "defines a description for every permission in the %s locale",
    (_locale, translation) => {
      const descriptions = translation.adminUsersView.permissionsMatrix.descriptions as Record<
        string,
        string
      >;

      permissionsOrder.forEach((permission) => {
        const translationKey = permission.replaceAll(".", "_");
        expect(descriptions[translationKey], translationKey).toBeTruthy();
      });
    },
  );
});
