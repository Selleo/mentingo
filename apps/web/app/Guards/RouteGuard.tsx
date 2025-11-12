import { useLocation, useNavigate } from "@remix-run/react";
import { useLayoutEffect } from "react";

import { routeAccessConfig } from "~/config/routeAccessConfig";
import { useUserRole } from "~/hooks/useUserRole";
import { useAuthStore } from "~/modules/Auth/authStore";

import type { ReactNode } from "react";
import type { UserRole } from "~/config/userRoles";

export const checkRouteAccess = (path: string, userRole: UserRole) => {
  const isLoggedIn = useAuthStore.getState().isLoggedIn;

  for (const [pattern, roles] of Object.entries(routeAccessConfig)) {
    const patternSegments = pattern.split("/");
    const pathSegments = path.split("/");

    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);

      if (path.startsWith(prefix)) {
        if (!isLoggedIn) {
          return true;
        }

        if (roles.includes(userRole)) {
          return true;
        }

        continue;
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

    if (isLoggedIn) {
      if (matches && roles.includes(userRole)) {
        return true;
      }
    }

    if (!isLoggedIn) {
      if (matches) {
        return true;
      }
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
