import { PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { asMcpStudentUser } from "./mcp-student-access";
import type { CurrentUserType } from "src/common/types/current-user.type";

const account: CurrentUserType = {
  userId: "00000000-0000-4000-8000-000000000001",
  tenantId: "00000000-0000-4000-8000-000000000002",
  email: "owner@example.test",
  roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
  permissions: Object.values(PERMISSIONS),
};
describe("student integration permission ceiling", () => {
  it("preserves identity and removes management, authoring and role shortcuts", () => {
    const learner = asMcpStudentUser(account);
    expect(learner.userId).toBe(account.userId);
    expect(learner.tenantId).toBe(account.tenantId);
    expect(learner.permissions).toEqual(
      expect.arrayContaining([PERMISSIONS.COURSE_READ, PERMISSIONS.ARTICLE_READ_PUBLIC]),
    );
    for (const permission of [
      PERMISSIONS.COURSE_UPDATE,
      PERMISSIONS.COURSE_UPDATE_OWN,
      PERMISSIONS.ARTICLE_MANAGE,
      PERMISSIONS.RESOURCE_LIBRARY_MANAGE,
      PERMISSIONS.USER_MANAGE,
    ]) {
      expect(learner.permissions).not.toContain(permission);
    }
    expect(learner.roleSlugs).toEqual([]);
  });
  it("never adds student permissions the connected account does not have", () => {
    expect(asMcpStudentUser({ ...account, permissions: [] }).permissions).toEqual([]);
    expect(
      asMcpStudentUser({ ...account, permissions: [PERMISSIONS.COURSE_UPDATE] }).permissions,
    ).toEqual([]);
  });
});
