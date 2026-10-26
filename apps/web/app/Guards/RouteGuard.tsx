import { Navigate, useLocation } from "@remix-run/react";
import { match } from "ts-pattern";

import { useCurrentUserSessionSuspense } from "~/api/queries/useCurrentUserSessionSuspense";
import { matchesRequirement, type PermissionKey } from "~/common/permissions/permission.utils";
import { RequireAuthenticatedUser } from "~/Guards/RequireAuthenticatedUser";

import { routeAccessConfig } from "../config/routeAccessConfig";

import type { ReactNode } from "react";

const routePatterns = Object.entries(routeAccessConfig);
const exactRoutePatterns = routePatterns.filter(([pattern]) => !pattern.endsWith("/*"));
const wildcardRoutePatterns = routePatterns.filter(([pattern]) => pattern.endsWith("/*"));

const matchesExactPattern = (pattern: string, pathSegments: string[]) => {
  const patternSegments = pattern.split("/");
  if (patternSegments.length !== pathSegments.length) return false;

  return patternSegments.every(
    (segment, index) => segment.startsWith(":") || segment === pathSegments[index],
  );
};

const matchesWildcardPattern = (pattern: string, path: string) => {
  const prefix = pattern.slice(0, -2);
  return path === prefix || path.startsWith(`${prefix}/`);
};

const findRouteRequirement = (path: string) => {
  const pathSegments = path.split("/");

  return (
    exactRoutePatterns.find(([pattern]) => matchesExactPattern(pattern, pathSegments))?.[1] ??
    wildcardRoutePatterns.find(([pattern]) => matchesWildcardPattern(pattern, path))?.[1]
  );
};

export const checkRouteAccess = (path: string, permissions: PermissionKey[]) => {
  const normalizedPath = path.replace(/^\//, "").replace(/\/$/, "").toLowerCase();
  const requirement = findRouteRequirement(normalizedPath);

  return Boolean(requirement && matchesRequirement(permissions, requirement));
};

export const RouteGuard = ({ children }: { children: ReactNode }) => {
  const { data: user } = useCurrentUserSessionSuspense();
  const { pathname } = useLocation();
  const hasAccess = checkRouteAccess(pathname, user?.permissions ?? []);

  return match({ hasAccess, isAnonymous: !user })
    .with({ hasAccess: true }, () => <>{children}</>)
    .with({ isAnonymous: true }, () => (
      <RequireAuthenticatedUser>{children}</RequireAuthenticatedUser>
    ))
    .otherwise(() => <Navigate to="/" replace />);
};
