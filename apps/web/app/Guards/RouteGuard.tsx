import { useLocation, useNavigate } from "@remix-run/react";
import { useLayoutEffect } from "react";

import { routeAccessConfig } from "../config/routeAccessConfig";
import { useUserRole } from "../hooks/useUserRole";

import type { UserRole } from "../config/userRoles";
import type { ReactNode } from "react";

export const checkRouteAccess = (path: string, userRole: UserRole) => {
  for (const [pattern, roles] of Object.entries(routeAccessConfig)) {
    const patternSegments = pattern.split("/");
    const pathSegments = path.split("/");
    const hasRoleAccess = roles.includes(userRole);

    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      if (path.startsWith(prefix)) {
        return hasRoleAccess;
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
      return hasRoleAccess;
    }
  }

  return false;
};

export const RouteGuard = ({ children }: { children: ReactNode }) => {
  const { role } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  const hasAccess = checkRouteAccess(location.pathname.replace("/", ""), role as UserRole);

  useLayoutEffect(() => {
    if (!hasAccess) {
      navigate("/");
    }
  }, [hasAccess, navigate]);

  if (!hasAccess) return null;

  return <>{children}</>;
};
