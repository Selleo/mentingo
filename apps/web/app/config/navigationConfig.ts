import { routeAccessConfig } from "./routeAccessConfig";

import type { UserRole } from "./userRoles";
import type i18next from "i18next";
import type { IconName } from "~/types/shared";

export interface BaseMenuItem {
  label: string;
  roles?: UserRole[];
}

export interface LeafMenuItem extends BaseMenuItem {
  link: string;
  iconName: IconName;
}

export type MenuItemType = LeafMenuItem;

export type NavigationItem = {
  label: string;
  path: string;
  iconName: IconName;
};

export const getNavigationConfig = (
  userId: string,
  isUser = true,
  t: typeof i18next.t,
): NavigationItem[] => [
  {
    label: t("navigationSideBar.dashboard"),
    path: "",
    iconName: "Dashboard",
  },
  {
    label: t("navigationSideBar.myCourses"),
    path: "admin/courses",
    iconName: "Course",
  },
  {
    label: isUser ? t("navigationSideBar.courses") : t("navigationSideBar.browseCourses"),
    path: "courses",
    iconName: isUser ? "Course" : "Multi",
  },
  {
    label: t("navigationSideBar.categories"),
    path: "admin/categories",
    iconName: "Category",
  },
  {
    label: t("navigationSideBar.users"),
    path: "admin/users",
    iconName: "Hat",
  },
  {
    label: t("navigationSideBar.groups"),
    path: "admin/groups",
    iconName: "Share",
  },
  {
    label: t("navigationSideBar.profile"),
    path: `profile/${userId}`,
    iconName: "User",
  },
  {
    label: t("navigationSideBar.announcements"),
    path: `announcements`,
    iconName: "Megaphone",
  },
];

/**
 * Finds matching route access roles for a given path by checking different types of routes in order:
 * 1. Exact matches (e.g., "courses/new" matches "courses/new")
 * 2. Parameter routes (e.g., "profile/123" matches "profile/:id")
 * 3. Wildcard routes (e.g., "profile/123/settings" matches "profile/*")
 *
 * @param path - The actual URL path to match (e.g., "profile/123")
 * @returns UserRole[] | undefined - Array of user roles that can access this path, or undefined if no match
 *
 * @example
 * // Exact match
 * findMatchingRoute("courses/new") // matches "courses/new" in config
 *
 * // Parameter match
 * findMatchingRoute("profile/123") // matches "profile/:id" in config
 * findMatchingRoute("course/456/lesson/789") // matches "course/:courseId/lesson/:lessonId"
 *
 * // Wildcard match
 * findMatchingRoute("profile/123/settings") // matches "profile/*"
 *
 * How matching works:
 * 1. First, tries to find an exact match in routeAccessConfig
 * 2. If no exact match, looks for parameter routes (:id)
 *    - Splits both paths into segments
 *    - Segments with ":" are treated as valid matches for any value
 *    - All other segments must match exactly
 * 3. If still no match, checks wildcard routes (*)
 *    - Matches if path starts with the part before "*"
 */
export const findMatchingRoute = (path: string) => {
  if (routeAccessConfig[path]) {
    return routeAccessConfig[path];
  }

  const paramRoutes = Object.entries(routeAccessConfig).filter(
    ([route]) => route.includes(":") && !route.includes("*"),
  );

  for (const [route, roles] of paramRoutes) {
    const routeParts = route.split("/");
    const pathParts = path.split("/");

    if (routeParts.length !== pathParts.length) continue;

    const matches = routeParts.every((part, index) => {
      if (part.startsWith(":")) return true;
      return part === pathParts[index];
    });

    if (matches) return roles;
  }

  const wildcardRoutes = Object.entries(routeAccessConfig).filter(([route]) => route.includes("*"));

  for (const [route, roles] of wildcardRoutes) {
    const routeWithoutWildcard = route.replace("/*", "");
    if (path.startsWith(routeWithoutWildcard)) {
      return roles;
    }
  }

  return undefined;
};

export const mapNavigationItems = (items: NavigationItem[]) => {
  return items.map((item) => {
    const roles = findMatchingRoute(item.path);

    return {
      ...item,
      link: `/${item.path}`,
      roles,
    };
  });
};
