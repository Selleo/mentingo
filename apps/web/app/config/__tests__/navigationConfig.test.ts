import { findMatchingRoute, mapNavigationItems } from "../navigationConfig";
import { USER_ROLE } from "../userRoles";

import type { NavigationItem } from "../navigationConfig";

describe("findMatchingRoute", () => {
  it("should find exact matches", () => {
    const roles = findMatchingRoute("admin/courses");
    expect(roles).toEqual([USER_ROLE.admin, USER_ROLE.contentCreator]);
  });

  it("should handle wildcard patterns", () => {
    const roles = findMatchingRoute("admin/users/123");
    expect(roles).toEqual([USER_ROLE.admin]);
  });

  it("should return undefined for non-existing routes", () => {
    const roles = findMatchingRoute("non/existing/route");
    expect(roles).toBeUndefined();
  });
});

describe("mapNavigationItems", () => {
  it("should correctly map navigation items with roles", () => {
    const items: NavigationItem[] = [
      {
        label: "courses",
        path: "admin/courses",
        iconName: "Course",
      },
    ];

    const mapped = mapNavigationItems(items);
    expect(mapped[0]).toEqual({
      label: "courses",
      path: "admin/courses",
      iconName: "Course",
      link: "/admin/courses",
      roles: [USER_ROLE.admin, USER_ROLE.contentCreator],
    });
  });

  it("should handle items with wildcard routes", () => {
    const items: NavigationItem[] = [
      {
        label: "users",
        path: "admin/users",
        iconName: "User",
      },
    ];

    const mapped = mapNavigationItems(items);
    expect(mapped[0].roles).toEqual([USER_ROLE.admin]);
  });

  it("should preserve all original item properties", () => {
    const items: NavigationItem[] = [
      {
        label: "dashboard",
        path: "",
        iconName: "Dashboard",
      },
    ];

    const mapped = mapNavigationItems(items);
    expect(mapped[0]).toMatchObject({
      label: "dashboard",
      path: "",
      iconName: "Dashboard",
      link: "/",
      roles: expect.any(Array),
    });
  });

  it("should handle items without matching routes", () => {
    const items: NavigationItem[] = [
      {
        label: "invalid",
        path: "non/existing/route",
        iconName: "Course",
      },
    ];

    const mapped = mapNavigationItems(items);
    expect(mapped[0].roles).toBeUndefined();
  });
});
