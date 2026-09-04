import { PERMISSIONS } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { canAccessAdminLayout } from "./Admin.layout";

describe("canAccessAdminLayout", () => {
  it("rejects a Group Manager from the admin layout", () => {
    expect(canAccessAdminLayout([PERMISSIONS.MANAGED_GROUP_RESULTS_READ])).toBe(false);
  });

  it("allows users with an admin-layout permission", () => {
    expect(canAccessAdminLayout([PERMISSIONS.COURSE_UPDATE_OWN])).toBe(true);
  });

  it("continues to reject users without an admin-layout permission", () => {
    expect(canAccessAdminLayout([PERMISSIONS.COURSE_READ])).toBe(false);
  });
});
