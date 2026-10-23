import { Navigate, useLocation } from "@remix-run/react";

import { useCurrentUserSessionSuspense } from "~/api/queries/useCurrentUserSessionSuspense";
import { matchesRequirement, type PermissionKey } from "~/common/permissions/permission.utils";
import { RequireAuthenticatedUser } from "~/Guards/RequireAuthenticatedUser";

import { routeAccessConfig } from "../config/routeAccessConfig";

import type { ReactNode } from "react";

export const checkRouteAccess = (path: string, permissions: PermissionKey[]) => {
  path = path.replace(/^\//, "").replace(/\/$/, "").toLowerCase();
  for (const [pattern, requirement] of Object.entries(routeAccessConfig)) {
    const patternSegments = pattern.split("/");
    const pathSegments = path.split("/");

    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      if (path === prefix || path.startsWith(`${prefix}/`)) {
        return matchesRequirement(permissions, requirement);
      }
      continue;
    }

    if (patternSegments.length !== pathSegments.length) {
      continue;
    }

    const matches = patternSegments.every((segment, index) => {
      if (segment.startsWith(":")) {
        return true;
      }

      return segment === pathSegments[index];
    });

    if (matches) {
      return matchesRequirement(permissions, requirement);
    }
  }

  return false;
};

export const RouteGuard = ({ children }: { children: ReactNode }) => {
  const { data: user } = useCurrentUserSessionSuspense();
  const location = useLocation();
  const path = location.pathname.replace(/^\//, "").replace(/\/$/, "");
  const hasAccess = checkRouteAccess(path, user?.permissions ?? []);

  // A permission-protected route must never mount its children for an anonymous
  // session, including routes sharing the public dashboard layout.
  if (!user && !checkRouteAccess(path, [])) {
    return <RequireAuthenticatedUser>{children}</RequireAuthenticatedUser>;
  }
  if (!hasAccess) return <Navigate to="/" replace />;

  return <>{children}</>;
};
