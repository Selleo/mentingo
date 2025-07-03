import { USER_ROLE } from "~/config/userRoles";

import { checkRouteAccess } from "../RouteGuard";

describe("checkRouteAccess", () => {
  it("should allow access to exact matching routes", () => {
    expect(checkRouteAccess("admin/courses", USER_ROLE.admin)).toBe(true);
    expect(checkRouteAccess("admin/courses", USER_ROLE.contentCreator)).toBe(true);
    expect(checkRouteAccess("admin/courses", USER_ROLE.student)).toBe(false);
  });

  it("should handle wildcard routes", () => {
    expect(checkRouteAccess("admin/users", USER_ROLE.admin)).toBe(true);
    expect(checkRouteAccess("admin/users/123", USER_ROLE.admin)).toBe(true);
    expect(checkRouteAccess("admin/users/new", USER_ROLE.admin)).toBe(true);
    expect(checkRouteAccess("admin/users", USER_ROLE.contentCreator)).toBe(false);
  });

  it("should handle public routes", () => {
    expect(checkRouteAccess("auth/login", USER_ROLE.admin)).toBe(true);
    expect(checkRouteAccess("auth/login", USER_ROLE.contentCreator)).toBe(true);
    expect(checkRouteAccess("auth/login", USER_ROLE.student)).toBe(true);
  });

  it("should deny access to non-existing routes", () => {
    expect(checkRouteAccess("non/existing/route", USER_ROLE.admin)).toBe(false);
  });
});
