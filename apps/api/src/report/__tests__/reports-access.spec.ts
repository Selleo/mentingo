import { PERMISSIONS } from "@repo/shared";

import { getReportsAccess, reportsAccessFingerprint } from "../reports-access";

import type { CurrentUserType } from "src/common/types/current-user.type";

const actor = (permissions: string[]): CurrentUserType => ({
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  email: "reporter@example.test",
  roleSlugs: [],
  permissions: permissions as CurrentUserType["permissions"],
});

describe("reports access", () => {
  it("keeps creator reports limited to owned courses unless broad course update is granted", () => {
    expect(
      getReportsAccess(actor([PERMISSIONS.REPORT_READ, PERMISSIONS.COURSE_UPDATE_OWN])),
    ).toMatchObject({
      canReadOrganisation: false,
      ownedCoursesOnly: true,
      canManageShared: false,
    });
    expect(
      getReportsAccess(
        actor([PERMISSIONS.REPORT_READ, PERMISSIONS.COURSE_UPDATE_OWN, PERMISSIONS.COURSE_UPDATE]),
      ),
    ).toMatchObject({
      canReadOrganisation: true,
      ownedCoursesOnly: false,
      canManageShared: true,
    });
  });

  it("keeps manager access additive and fingerprints current group assignments", () => {
    const access = getReportsAccess(
      actor([
        PERMISSIONS.REPORT_READ,
        PERMISSIONS.COURSE_UPDATE_OWN,
        PERMISSIONS.MANAGED_GROUP_RESULTS_READ,
      ]),
    );
    expect(access).toMatchObject({
      canReadOrganisation: false,
      canReadManagedGroups: true,
      ownedCoursesOnly: true,
      canManageShared: false,
    });
    expect(reportsAccessFingerprint(access, ["b", "a"])).toBe(
      reportsAccessFingerprint(access, ["a", "b"]),
    );
    expect(reportsAccessFingerprint(access, ["a"])).not.toBe(
      reportsAccessFingerprint(access, ["a", "b"]),
    );
  });
});
