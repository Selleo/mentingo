import { USER_ROLE } from "./userRoles";

import type { UserRole } from "./userRoles";

type PathSegment = string;
type ParamSegment = `:${string}`;
type WildcardSegment = "*";

type ValidSegment = PathSegment | ParamSegment | WildcardSegment;

/**
 * Type that validates entire paths to ensure they follow routing conventions:
 * - Can contain regular segments
 * - Can contain parameter segments (e.g., `:id`)
 * - Can end with a wildcard `*`
 * - Cannot start or end with `/`
 * - Cannot contain double slashes
 * @template T - String literal type representing the path
 */
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
  [P in string]: P extends ValidPath ? UserRole[] : never;
};

/**
 * @function createRouteConfig
 * @template T
 * @param {T} config - Route configuration object
 * @returns {RouteConfig} Validated route configuration
 * @throws {Error} If any path violates routing conventions
 *
 * Creates and validates a route configuration object. Throws errors for invalid paths:
 * - Paths starting with `/`
 * - Paths ending with `/`
 * - Paths containing double slashes (`//`)
 * - Paths with wildcards not at the end
 *
 * @example
 * const config = createRouteConfig({
 *   "auth/login": ALL_ROLES,
 *   "course/:id": ADMIN_ONLY,
 *   "admin/users/*": ADMIN_ONLY
 * });
 */
const createRouteConfig = <T extends Record<string, UserRole[]>>(config: T): RouteConfig => {
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

const defineRoles = <R extends UserRole[]>(roles: [...R]) => roles;

const ALL_ROLES = defineRoles([USER_ROLE.admin, USER_ROLE.teacher, USER_ROLE.student]);
const ADMIN_ONLY = defineRoles([USER_ROLE.admin]);
const ADMIN_AND_TEACHER = defineRoles([USER_ROLE.admin, USER_ROLE.teacher]);

export const routeAccessConfig = createRouteConfig({
  "auth/login": ALL_ROLES,
  "auth/register": ALL_ROLES,
  "auth/create-new-password": ALL_ROLES,
  "auth/password-recovery": ALL_ROLES,

  // Client part
  "": ALL_ROLES, // Dashboard
  settings: ALL_ROLES,
  "profile/:id": ALL_ROLES,
  "course/:courseId/lesson/:lessonId": ALL_ROLES,
  //Client and public
  "course/:id": ALL_ROLES,
  courses: ALL_ROLES,

  // Admin part
  "admin/courses": ADMIN_AND_TEACHER,
  "admin/courses/new": ADMIN_AND_TEACHER,
  "admin/beta-courses/new": ADMIN_AND_TEACHER,
  "admin/courses/:id": ADMIN_AND_TEACHER,
  "admin/beta-courses/:id": ADMIN_AND_TEACHER,
  "admin/users/*": ADMIN_ONLY,
  "admin/groups/*": ADMIN_ONLY,
  "admin/categories": ADMIN_ONLY,
  "admin/categories/:id": ADMIN_AND_TEACHER,
  "admin/categories/new": ADMIN_AND_TEACHER,
  "admin/lessons": ADMIN_AND_TEACHER,
  "admin/lessons/:id": ADMIN_AND_TEACHER,
  "admin/lessons/new": ADMIN_AND_TEACHER,
  "admin/lesson-items": ADMIN_AND_TEACHER,
  "admin/lesson-items/new-file": ADMIN_AND_TEACHER,
  "admin/lesson-items/new-text-block": ADMIN_AND_TEACHER,
  "admin/lesson-items/new-question": ADMIN_AND_TEACHER,
  "admin/lesson-items/:id": ADMIN_AND_TEACHER,
});
