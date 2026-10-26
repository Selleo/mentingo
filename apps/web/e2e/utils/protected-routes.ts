import { getRouteLeaves } from "../../routeInventory";

const PLACEHOLDER_ROUTE_PARAM = "00000000-0000-4000-8000-000000000001";

export const protectedRoutes = getRouteLeaves().flatMap(
  ({ path, requiresSession, requirement }) => {
    if (!requirement) return [];

    const requiresPermission = Boolean(requirement.allOf?.length || requirement.anyOf?.length);
    if (!requiresSession && !requiresPermission) return [];

    return [{ path: `/${path.replace(/:[^/]+/g, PLACEHOLDER_ROUTE_PARAM)}`, requirement }];
  },
);

if (!protectedRoutes.length) {
  throw new Error("No protected routes found; the route access E2E matrix would be empty");
}
