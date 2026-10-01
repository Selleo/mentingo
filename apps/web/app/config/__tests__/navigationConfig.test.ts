import { PERMISSIONS } from "@repo/shared";

import { findMatchingRoute, getNavigationConfig, mapNavigationItems } from "../navigationConfig";

import type { NavigationItem, NavigationGroups } from "../navigationConfig";
import type { TFunction } from "i18next";

describe("findMatchingRoute", () => {
  it("protects both AI conversation routes", () => {
    for (const path of ["admin/ai-conversations", "admin/ai-conversations/thread-id"]) {
      expect(findMatchingRoute(path)).toEqual({ allOf: [PERMISSIONS.AI_THREAD_READ] });
    }
  });
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

  it("should find learning path routes", () => {
    expect(findMatchingRoute("development-paths")).toEqual({
      anyOf: [PERMISSIONS.LEARNING_PATH_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ],
    });
  });

  it("should find calendar routes", () => {
    expect(findMatchingRoute("calendar")).toEqual({
      anyOf: [PERMISSIONS.CALENDAR_READ],
    });
  });

  it("should find admin learning path routes", () => {
    expect(findMatchingRoute("admin/development-paths/new")).toEqual({
      allOf: [PERMISSIONS.LEARNING_PATH_CREATE],
    });
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

  it("should prefer explicit item access requirements over route requirements", () => {
    const items: NavigationItem[] = [
      {
        label: "courses",
        path: "courses",
        iconName: "Course",
        accessRequirement: {
          anyOf: [PERMISSIONS.COURSE_READ],
        },
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
      anyOf: [PERMISSIONS.COURSE_READ],
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

describe("getNavigationConfig", () => {
  const t = ((key: string) => key) as TFunction;

  it("should hide phishing until the tenant capability is enabled", () => {
    const groups = getNavigationConfig(t);

    expect(groups.flatMap((group) => group.items).some((item) => item.path === "phishing")).toBe(
      false,
    );
  });

  it("should show enabled phishing with its permission requirements", () => {
    const groups = getNavigationConfig(t, false, false, false, false, false, false, true);
    const phishing = groups.find((group) => group.items.some((item) => item.path === "phishing"));

    expect(phishing?.restrictedAccessRequirement).toEqual({
      anyOf: [PERMISSIONS.PHISHING_MANAGE, PERMISSIONS.PHISHING_REPORT_READ],
    });
    expect(phishing?.items[0].accessRequirement).toEqual(phishing?.restrictedAccessRequirement);
  });

  const getCourseItems = (isLearningPathsEnabled: boolean, shouldShowLearningPaths: boolean) =>
    getNavigationConfig(
      t,
      false,
      false,
      false,
      false,
      isLearningPathsEnabled,
      shouldShowLearningPaths,
    )[0].items;

  it("should hide learning paths when the feature is disabled", () => {
    const items = getCourseItems(false, true);

    expect(items.some((item) => item.path === "development-paths")).toBe(false);
  });

  it("should hide learning paths when students have no available paths", () => {
    const items = getCourseItems(true, false);

    expect(items.some((item) => item.path === "development-paths")).toBe(false);
  });

  it("should show learning paths when enabled and available", () => {
    const items = getCourseItems(true, true);

    expect(items.some((item) => item.path === "development-paths")).toBe(true);
  });

  it("should link Group Managers to the regular courses route", () => {
    const items = getCourseItems(false, false);
    const coursesItem = items.find((item) => item.path === "courses");

    expect(coursesItem?.accessRequirement).toEqual({
      anyOf: [PERMISSIONS.COURSE_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ],
    });
    expect(items.some((item) => item.path === "admin/courses")).toBe(false);
  });
});
