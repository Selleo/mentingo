import { PERMISSIONS } from "@repo/shared";

import { findMatchingRoute, mapNavigationItems } from "../navigationConfig";

import type { NavigationItem, NavigationGroups } from "../navigationConfig";

describe("findMatchingRoute", () => {
  it("should find exact matches", () => {
    const requirement = findMatchingRoute("admin/courses");
    expect(requirement).toEqual({
      anyOf: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
    });
  });

  it("should handle wildcard patterns", () => {
    const requirement = findMatchingRoute("admin/users/123");
    expect(requirement).toEqual({
      allOf: [PERMISSIONS.USER_MANAGE],
    });
  });

  it("should return undefined for non-existing routes", () => {
    const requirement = findMatchingRoute("non/existing/route");
    expect(requirement).toBeUndefined();
  });
});

describe("mapNavigationItems", () => {
  it("should correctly map navigation items with access requirements", () => {
    const items: NavigationItem[] = [
      {
        label: "courses",
        path: "admin/courses",
        iconName: "Course",
      },
    ];

    const groups: NavigationGroups[] = [
      {
        title: "test",
        items,
      },
    ];

    const mappedGroups = mapNavigationItems(groups);
    const mapped = mappedGroups[0].items;

    expect(mapped[0]).toEqual({
      label: "courses",
      path: "admin/courses",
      iconName: "Course",
      link: "/admin/courses",
      accessRequirement: {
        anyOf: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
      },
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

    const groups: NavigationGroups[] = [
      {
        title: "test",
        items,
      },
    ];

    const mappedGroups = mapNavigationItems(groups);
    const mapped = mappedGroups[0].items;

    expect(mapped[0].accessRequirement).toEqual({
      allOf: [PERMISSIONS.USER_MANAGE],
    });
  });

  it("should preserve all original item properties", () => {
    const items: NavigationItem[] = [
      {
        label: "dashboard",
        path: "",
        iconName: "Dashboard",
      },
    ];

    const groups: NavigationGroups[] = [
      {
        title: "test",
        items,
      },
    ];

    const mappedGroups = mapNavigationItems(groups);
    const mapped = mappedGroups[0].items;

    expect(mapped[0]).toMatchObject({
      label: "dashboard",
      path: "",
      iconName: "Dashboard",
      link: "/",
      accessRequirement: expect.any(Object),
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

    const groups: NavigationGroups[] = [
      {
        title: "test",
        items,
      },
    ];

    const mappedGroups = mapNavigationItems(groups);
    const mapped = mappedGroups[0].items;

    expect(mapped[0].accessRequirement).toBeUndefined();
  });
});
