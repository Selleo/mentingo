import { defineRoutes } from "@remix-run/dev/dist/config/routes";
import { matchesRequirement, PERMISSIONS, SYSTEM_ROLE_PERMISSIONS } from "@repo/shared";
import { matchPath } from "react-router-dom";

import { routes } from "../../routes";
import { checkRouteAccess } from "../Guards/RouteGuard";

import { routeAccessConfig } from "./routeAccessConfig";

import type { RouteManifest } from "@remix-run/dev/dist/config/routes";

// Derive leaf URLs from the actual Remix tree, not a separately maintained list.
export async function getRoutePaths() {
  const manifest: RouteManifest = await routes(defineRoutes);
  const fullPath = (id: string): string => {
    const entry = manifest[id];
    const parent = entry.parentId && manifest[entry.parentId] ? fullPath(entry.parentId) : "";
    return [parent, entry.path].filter(Boolean).join("/");
  };
  return Object.values(manifest)
    .filter((entry) => !Object.values(manifest).some((child) => child.parentId === entry.id))
    .map((entry) => fullPath(entry.id));
}

describe("route access inventory", () => {
  it("explicitly covers every leaf in the Remix route tree", async () => {
    for (const path of await getRoutePaths()) {
      expect(checkRouteAccess(path, Object.values(PERMISSIONS)), path).toBe(true);
    }
  });

  it("audits every leaf against the permission matrix of every built-in role", async () => {
    for (const path of await getRoutePaths()) {
      const requirement = Object.entries(routeAccessConfig).find(([pattern]) =>
        matchPath({ path: pattern, end: true }, `/${path}`),
      )?.[1];
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
