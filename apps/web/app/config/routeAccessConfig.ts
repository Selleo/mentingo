import { PERMISSIONS } from "@repo/shared";

import type { PermissionRequirement } from "~/common/permissions/permission.utils";

type PathSegment = string;
type ParamSegment = `:${string}`;
type WildcardSegment = "*";

type ValidSegment = PathSegment | ParamSegment | WildcardSegment;
type ValidPath<T extends string = string> = T extends ""
  ? T
  : T extends `${infer First}/${infer Rest}`
    ? First extends ValidSegment
      ? Rest extends "*"
        ? `${First}/*`
        : `${First}/${ValidPath<Rest>}`
      : never
    : T extends ValidSegment
      ? T
      : never;

type RouteConfig = {
  [P in string]: P extends ValidPath ? PermissionRequirement : never;
};

const createRouteConfig = <T extends Record<string, PermissionRequirement>>(
  config: T,
): RouteConfig => {
  Object.keys(config).forEach((path) => {
    if (path.startsWith("/")) {
      throw new Error(`Invalid path: ${path} - cannot start with /`);
    }
    if (path.endsWith("/")) {
      throw new Error(`Invalid path: ${path} - cannot end with /`);
    }
    if (path.includes("//")) {
      throw new Error(`Invalid path: ${path} - cannot contain double slashes`);
    }
    if (path.includes("*") && !path.endsWith("*")) {
      throw new Error(`Invalid path: ${path} - wildcard can only be at the end`);
    }
  });

  return config as RouteConfig;
};

const PUBLIC: PermissionRequirement = {};
const USER_MANAGEMENT_ACCESS: PermissionRequirement = {
  allOf: [PERMISSIONS.USER_MANAGE],
};
const COURSE_EDIT_ACCESS: PermissionRequirement = {
  anyOf: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
};
const ARTICLE_EDIT_ACCESS: PermissionRequirement = {
  anyOf: [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
};
const NEWS_EDIT_ACCESS: PermissionRequirement = {
  anyOf: [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN],
};
const QA_EDIT_ACCESS: PermissionRequirement = {
  anyOf: [PERMISSIONS.QA_MANAGE, PERMISSIONS.QA_MANAGE_OWN],
};
const LEARNING_PROGRESS_ACCESS: PermissionRequirement = {
  anyOf: [PERMISSIONS.LEARNING_PROGRESS_UPDATE, PERMISSIONS.LEARNING_MODE_USE],
};

export const routeAccessConfig = createRouteConfig({
  "auth/login": PUBLIC,
  "auth/register": PUBLIC,
  "auth/create-new-password": PUBLIC,
  "auth/password-recovery": PUBLIC,

  // Client part
  "": PUBLIC,
  progress: LEARNING_PROGRESS_ACCESS,
  settings: PUBLIC,
  "profile/:id": PUBLIC,
  "course/:courseId/lesson/:lessonId": PUBLIC,
  announcements: PUBLIC,
  "articles/:articleId/edit": ARTICLE_EDIT_ACCESS,
  "news/add": NEWS_EDIT_ACCESS,
  "news/:newsId/edit": NEWS_EDIT_ACCESS,
  // Client and public
  "course/:id": PUBLIC,
  courses: PUBLIC,
  qa: PUBLIC,
  "qa/:id": QA_EDIT_ACCESS,
  articles: PUBLIC,
  "articles/:articleId": PUBLIC,
  news: PUBLIC,
  "news/:newsId": PUBLIC,

  // Admin part
  "admin/analytics": {
    allOf: [PERMISSIONS.STATISTICS_READ],
  },
  "admin/courses": COURSE_EDIT_ACCESS,
  "admin/courses/new": COURSE_EDIT_ACCESS,
  "admin/course/:courseId/lesson/:lessonId/preview": COURSE_EDIT_ACCESS,
  "admin/beta-courses/new": {
    allOf: [PERMISSIONS.COURSE_CREATE],
  },
  "admin/courses/:id": COURSE_EDIT_ACCESS,
  "admin/beta-courses/:id": COURSE_EDIT_ACCESS,
  "admin/users/*": USER_MANAGEMENT_ACCESS,
  "admin/groups/*": {
    allOf: [PERMISSIONS.GROUP_MANAGE],
  },
  "admin/categories/*": {
    allOf: [PERMISSIONS.CATEGORY_MANAGE],
  },
  "admin/lessons/*": COURSE_EDIT_ACCESS,
  "admin/lesson-items/*": COURSE_EDIT_ACCESS,
  "admin/announcements/new": {
    allOf: [PERMISSIONS.ANNOUNCEMENT_CREATE],
  },
  "provider-information": PUBLIC,
  "admin/promotion-codes": {
    allOf: [PERMISSIONS.BILLING_MANAGE],
  },
  "admin/promotion-codes/*": {
    allOf: [PERMISSIONS.BILLING_MANAGE],
  },
  "admin/envs": {
    allOf: [PERMISSIONS.ENV_MANAGE],
  },
  "admin/activity-logs": {
    allOf: [PERMISSIONS.ACTIVITY_LOG_READ],
  },
  "super-admin/*": {
    allOf: [PERMISSIONS.TENANT_MANAGE],
  },
});
