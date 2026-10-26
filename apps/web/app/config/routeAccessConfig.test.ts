import { matchesRequirement, PERMISSIONS, SYSTEM_ROLE_PERMISSIONS } from "@repo/shared";

import { getRouteLeaves } from "../../routeInventory";
import { checkRouteAccess } from "../Guards/RouteGuard";

describe("route access inventory", () => {
  it("explicitly covers every leaf in the Remix route tree", () => {
    for (const { path } of getRouteLeaves()) {
      expect(checkRouteAccess(path, Object.values(PERMISSIONS)), path).toBe(true);
    }
  });

  it("audits every leaf against the permission matrix of every built-in role", () => {
    for (const { path, requirement } of getRouteLeaves()) {
      expect(requirement, path).toBeDefined();
      for (const [role, permissions] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
        expect(checkRouteAccess(path, permissions), `${role}: ${path}`).toBe(
          matchesRequirement(permissions, requirement!),
        );
      }
    }
  });

  it("enforces reports permissions for every built-in role", () => {
    for (const [role, permissions] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
      const allowed = permissions.some((permission) =>
        [PERMISSIONS.REPORT_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ].includes(
          permission as typeof PERMISSIONS.REPORT_READ,
        ),
      );
      expect(checkRouteAccess("reports", [...permissions]), role).toBe(allowed);
    }
    expect(checkRouteAccess("reports", [])).toBe(false);
  });
});
