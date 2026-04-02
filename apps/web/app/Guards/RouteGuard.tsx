import { useLocation, useNavigate } from "@remix-run/react";
import { useLayoutEffect } from "react";

import { useCurrentUserSuspense } from "~/api/queries";
import { matchesRequirement, type PermissionKey } from "~/common/permissions/permission.utils";

import { routeAccessConfig } from "../config/routeAccessConfig";

import type { ReactNode } from "react";

export const checkRouteAccess = (path: string, permissions: PermissionKey[]) => {
  for (const [pattern, requirement] of Object.entries(routeAccessConfig)) {
    const patternSegments = pattern.split("/");
    const pathSegments = path.split("/");

    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      if (path.startsWith(prefix)) {
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
  const { data } = useCurrentUserSuspense();
  const permissions = data?.permissions ?? [];
  const navigate = useNavigate();
  const location = useLocation();

  const hasAccess = checkRouteAccess(location.pathname.replace("/", ""), permissions);

  useLayoutEffect(() => {
    if (!hasAccess) {
      navigate("/");
    }
  }, [hasAccess, navigate]);

  if (!hasAccess) return null;

  return <>{children}</>;
};
