import { PERMISSIONS } from "@repo/shared";

import { NAVIGATION_HANDLES } from "../../e2e/data/navigation/handles";

import { routeAccessConfig } from "./routeAccessConfig";

import type { TFunction } from "i18next";
import type { PermissionRequirement } from "~/common/permissions/permission.utils";
import type { IconName } from "~/types/shared";

export interface BaseMenuItem {
  label: string;
  accessRequirement?: PermissionRequirement;
  testId?: string;
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
  testId?: string;
};

export type NavigationGroups = {
  title: string;
  icon?: IconName;
  isExpandable?: boolean;
  restrictedAccessRequirement?: PermissionRequirement;
  restrictedManagingTenantAdmin?: boolean;
  testId?: string;
  items: NavigationItem[];
};

export const getNavigationConfig = (
  t: TFunction,
  isQAEnabled = false,
  isNewsEnabled = false,
  isArticlesEnabled = false,
  isStripeConfigured = false,
): NavigationGroups[] => {
  const isAnyContentFeatureEnabled = isQAEnabled || isNewsEnabled || isArticlesEnabled;

  return [
    {
      title: t("navigationSideBar.courses"),
      isExpandable: false,
      testId: NAVIGATION_HANDLES.COURSES_GROUP,
      items: [
        {
          label: t("navigationSideBar.courses"),
          path: "courses",
          iconName: "Course",
          testId: NAVIGATION_HANDLES.COURSES_LINK,
        },
        {
          label: t("navigationSideBar.analytics"),
          path: "admin/analytics",
          iconName: "ChartNoAxes",
          testId: NAVIGATION_HANDLES.ANALYTICS_LINK,
        },
        {
          label: t("navigationSideBar.progress"),
          path: "progress",
          iconName: "Target",
          testId: NAVIGATION_HANDLES.PROGRESS_LINK,
        },
      ],
    },
    ...(isAnyContentFeatureEnabled
      ? ([
          {
            title: t("navigationSideBar.content"),
            icon: "Library",
            isExpandable: true,
            testId: NAVIGATION_HANDLES.CONTENT_GROUP,
            restrictedAccessRequirement: {
              anyOf: [
                PERMISSIONS.NEWS_MANAGE,
                PERMISSIONS.NEWS_MANAGE_OWN,
                PERMISSIONS.NEWS_READ_PUBLIC,
                PERMISSIONS.ARTICLE_MANAGE,
                PERMISSIONS.ARTICLE_MANAGE_OWN,
                PERMISSIONS.ARTICLE_READ_PUBLIC,
                PERMISSIONS.QA_MANAGE,
                PERMISSIONS.QA_MANAGE_OWN,
                PERMISSIONS.QA_READ_PUBLIC,
              ],
            },
            items: [
              ...(isNewsEnabled
                ? ([
                    {
                      label: t("navigationSideBar.news"),
                      path: `news`,
                      iconName: "News",
                      testId: NAVIGATION_HANDLES.NEWS_LINK,
                    },
                  ] as NavigationItem[])
                : []),
              ...(isArticlesEnabled
                ? ([
                    {
                      label: t("navigationSideBar.articles"),
                      path: `articles`,
                      iconName: "Articles",
                      testId: NAVIGATION_HANDLES.ARTICLES_LINK,
                    },
                  ] as NavigationItem[])
                : []),
              ...(isQAEnabled
                ? ([
                    {
                      label: t("navigationSideBar.qa"),
                      path: "qa",
                      iconName: "Quiz",
                      testId: NAVIGATION_HANDLES.QA_LINK,
                    },
                  ] as NavigationItem[])
                : []),
            ],
          },
        ] satisfies NavigationGroups[])
      : []),
    {
      title: t("navigationSideBar.manage"),
      icon: "Manage",
      isExpandable: true,
      testId: NAVIGATION_HANDLES.MANAGE_TOGGLE,
      restrictedAccessRequirement: {
        anyOf: [
          PERMISSIONS.USER_MANAGE,
          PERMISSIONS.GROUP_MANAGE,
          PERMISSIONS.CATEGORY_MANAGE,
          PERMISSIONS.BILLING_MANAGE,
        ],
      },
      items: [
        {
          label: t("navigationSideBar.users"),
          path: "admin/users",
          iconName: "Hat",
          testId: NAVIGATION_HANDLES.USERS_LINK,
        },
        {
          label: t("navigationSideBar.groups"),
          path: "admin/groups",
          iconName: "Share",
          testId: NAVIGATION_HANDLES.GROUPS_LINK,
        },
        {
          label: t("navigationSideBar.categories"),
          path: "admin/categories",
          iconName: "Category",
          testId: NAVIGATION_HANDLES.CATEGORIES_LINK,
        },
        ...(isStripeConfigured
          ? [
              {
                label: t("navigationSideBar.promotionCodes", "Promotion Codes"),
                path: "admin/promotion-codes",
                iconName: "HandCoins",
                testId: NAVIGATION_HANDLES.PROMOTION_CODES_LINK,
              } as NavigationItem,
            ]
          : []),
      ],
    },
    {
      title: t("navigationSideBar.superAdmin", "Super Admin"),
      icon: "Admin",
      isExpandable: false,
      testId: NAVIGATION_HANDLES.SUPER_ADMIN_GROUP,
      restrictedAccessRequirement: {
        allOf: [PERMISSIONS.TENANT_MANAGE],
      },
      restrictedManagingTenantAdmin: true,
      items: [
        {
          label: t("navigationSideBar.tenants", "Tenants"),
          path: "super-admin/tenants",
          iconName: "Admin",
          testId: NAVIGATION_HANDLES.TENANTS_LINK,
        },
      ],
    },
    {
      title: t("navigationSideBar.activityLogs"),
      icon: "Timeline",
      isExpandable: false,
      testId: NAVIGATION_HANDLES.ACTIVITY_LOGS_LINK,
      restrictedAccessRequirement: {
        allOf: [PERMISSIONS.ACTIVITY_LOG_READ],
      },
      restrictedManagingTenantAdmin: false,
      items: [
        {
          label: t("navigationSideBar.activityLogs"),
          path: "admin/activity-logs",
          iconName: "Timeline",
          testId: NAVIGATION_HANDLES.ACTIVITY_LOGS_LINK,
        },
      ],
    },
  ];
};

/**
 * Finds matching route access requirements for a given path by checking different types of routes in order:
 * 1. Exact matches (e.g., "courses/new" matches "courses/new")
 * 2. Parameter routes (e.g., "profile/123" matches "profile/:id")
 * 3. Wildcard routes (e.g., "profile/123/settings" matches "profile/*")
 *
 * @param path - The actual URL path to match (e.g., "profile/123")
 * @returns PermissionRequirement | undefined - Requirement that can access this path, or undefined if no match
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

  for (const [route, requirement] of paramRoutes) {
    const routeParts = route.split("/");
    const pathParts = path.split("/");

    if (routeParts.length !== pathParts.length) continue;

    const matches = routeParts.every((part, index) => {
      if (part.startsWith(":")) return true;
      return part === pathParts[index];
    });

    if (matches) return requirement;
  }

  const wildcardRoutes = Object.entries(routeAccessConfig).filter(([route]) => route.includes("*"));

  for (const [route, requirement] of wildcardRoutes) {
    const routeWithoutWildcard = route.replace("/*", "");
    if (path.startsWith(routeWithoutWildcard)) {
      return requirement;
    }
  }

  return undefined;
};

const mapMenuItemsWithRolesAndLink = (items: NavigationItem[]) => {
  return items.map((item) => {
    const accessRequirement = findMatchingRoute(item.path);

    return {
      ...item,
      link: `/${item.path}`,
      accessRequirement,
    };
  });
};

export const mapNavigationItems = (groups: NavigationGroups[]) => {
  return groups.map((group) => {
    return {
      ...group,
      items: mapMenuItemsWithRolesAndLink(group.items),
    };
  });
};
