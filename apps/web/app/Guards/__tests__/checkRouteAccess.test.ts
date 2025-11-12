import { beforeEach, describe, expect, it, vi } from "vitest";

import { USER_ROLE } from "~/config/userRoles";
import { useAuthStore } from "~/modules/Auth/authStore";

import { checkRouteAccess } from "../RouteGuard";

vi.mock("~/modules/Auth/authStore", () => {
  const getState = vi.fn(() => ({ isLoggedIn: true, setLoggedIn: vi.fn() }));
  const useAuthStore = Object.assign(vi.fn(), { getState });
  return { useAuthStore };
});

describe("checkRouteAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore.getState).mockReturnValue({ isLoggedIn: true, setLoggedIn: vi.fn() });
  });

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
    vi.mocked(useAuthStore.getState).mockReturnValue({ isLoggedIn: false, setLoggedIn: vi.fn() });
    expect(checkRouteAccess("auth/login", USER_ROLE.admin)).toBe(true);
    expect(checkRouteAccess("auth/login", USER_ROLE.contentCreator)).toBe(true);
    expect(checkRouteAccess("auth/login", USER_ROLE.student)).toBe(true);
  });

  it("should deny access to non-existing routes", () => {
    expect(checkRouteAccess("non/existing/route", USER_ROLE.admin)).toBe(false);
  });
});
