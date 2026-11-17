import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

/**
 * Hard-coded expectations for direct route entry per system role. They are written out on
 * purpose instead of being derived from routeAccessConfig / SYSTEM_ROLE_PERMISSIONS, so a
 * widened permission or a new unguarded route fails the route-access specs.
 *
 * - `deniedRedirect`: where RouteGuard sends the role from a route it may not open
 *   (the first entry of getDefaultAuthenticatedRedirect the role qualifies for).
 * - `canAccessReports`: whether /reports and the report APIs are open to the role.
 * - `allowedRoutes`: protected routes the role may open (`:id` = any route param);
 *   every other protected route must redirect. Omitted for roles outside the denied-route matrix.
 */
export type RoleRouteAccess = {
  deniedRedirect: RegExp;
  canAccessReports: boolean;
  allowedRoutes?: readonly string[];
};

const COMMON_ALLOWED_ROUTES = [
  "/",
  "/assistant/:id",
  "/helpdesk/tutorials/:id",
  "/settings",
  "/provider-information",
  "/profile/:id",
] as const;

export const ROLE_ROUTE_ACCESS: Record<string, RoleRouteAccess> = {
  [SYSTEM_ROLE_SLUGS.ADMIN]: {
    deniedRedirect: /\/dashboard$/,
    canAccessReports: true,
  },
  [SYSTEM_ROLE_SLUGS.STUDENT]: {
    deniedRedirect: /\/dashboard$/,
    canAccessReports: false,
    allowedRoutes: [
      ...COMMON_ALLOWED_ROUTES,
      "/development-paths",
      "/calendar",
      "/live-training/:id/room",
      "/live-training/:id",
      "/dashboard",
      "/ai-mentor/practice/:id",
      "/competencies",
      "/leaderboards",
      "/forum",
      "/forum/topics/:id",
      "/notifications",
    ],
  },
  [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]: {
    deniedRedirect: /\/dashboard$/,
    canAccessReports: true,
    allowedRoutes: [
      ...COMMON_ALLOWED_ROUTES,
      "/development-paths",
      "/calendar",
      "/reports",
      "/live-training/:id/room",
      "/live-training/:id",
      "/qa/new",
      "/qa/:id",
      "/news/:id/edit",
      "/news/add",
      "/dashboard",
      "/ai-mentor/practice/:id",
      "/competencies",
      "/forum",
      "/forum/topics/:id",
      "/notifications",
      "/articles/:id/edit",
      "/admin/courses",
      "/admin/beta-courses/new",
      "/admin/beta-courses/new/standard",
      "/admin/courses/new-scorm",
      "/admin/courses/import-package",
      "/admin/beta-courses/:id",
      "/admin/beta-courses/:id/authoring",
    ],
  },
  [SYSTEM_ROLE_SLUGS.TRAINER]: {
    deniedRedirect: /\/dashboard$/,
    canAccessReports: false,
    allowedRoutes: [
      ...COMMON_ALLOWED_ROUTES,
      "/calendar",
      "/live-training/:id/room",
      "/live-training/:id",
      "/dashboard",
      "/competencies",
      "/forum",
      "/forum/topics/:id",
      "/notifications",
    ],
  },
  // Managed group results take precedence over the dashboard in the default redirect.
  [SYSTEM_ROLE_SLUGS.GROUP_MANAGER]: {
    deniedRedirect: /\/courses$/,
    canAccessReports: true,
    allowedRoutes: [
      ...COMMON_ALLOWED_ROUTES,
      "/development-paths",
      "/calendar",
      "/reports",
      "/live-training/:id/room",
      "/live-training/:id",
      "/dashboard",
      "/competencies",
      "/forum",
      "/forum/topics/:id",
      "/phishing",
      "/phishing/:id",
      "/notifications",
    ],
  },
  // The reviewer has no dashboard, course, calendar or path access, so it lands on the grading queue.
  [SYSTEM_ROLE_SLUGS.REVIEWER]: {
    deniedRedirect: /\/quiz-grading$/,
    canAccessReports: false,
    allowedRoutes: [...COMMON_ALLOWED_ROUTES, "/quiz-grading", "/quiz-grading/:id"],
  },
};

export const getRoleRouteAccess = (role: string) => {
  const access = ROLE_ROUTE_ACCESS[role];
  if (!access) throw new Error(`No route access expectations for role "${role}"`);
  return access;
};
