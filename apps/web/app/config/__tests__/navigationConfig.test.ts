import {
  matchesRequirement,
  PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  type PermissionKey,
} from "@repo/shared";

import { findMatchingRoute, getNavigationConfig, mapNavigationItems } from "../navigationConfig";
import { routeAccessConfig } from "../routeAccessConfig";

import type { NavigationItem, NavigationGroups } from "../navigationConfig";
import type { TFunction } from "i18next";

describe("findMatchingRoute", () => {
  it("does not require role permissions for authenticated Assistant routes", () => {
    for (const path of ["assistant", "assistant/thread-id"]) {
      expect(findMatchingRoute(path)).toEqual({});
      expect(matchesRequirement([], findMatchingRoute(path))).toBe(true);
    }
  });
  it("protects both AI conversation routes", () => {
    for (const path of ["admin/ai-conversations", "admin/ai-conversations/thread-id"]) {
      expect(findMatchingRoute(path)).toEqual({ allOf: [PERMISSIONS.AI_THREAD_READ] });
      expect(matchesRequirement([], findMatchingRoute(path))).toBe(false);
      expect(matchesRequirement([PERMISSIONS.COURSE_READ], findMatchingRoute(path))).toBe(false);
      expect(matchesRequirement([PERMISSIONS.AI_THREAD_READ], findMatchingRoute(path))).toBe(true);
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
  const forRoles = (roleSlugs: string[]) =>
    getNavigationConfig(t, false, false, false, false, false, false, false, roleSlugs);

  it("groups both AI destinations under one expandable section for admins", () => {
    const groups = forRoles([SYSTEM_ROLE_SLUGS.ADMIN]);
    const aiGroups = groups.filter((group) =>
      group.items.some((item) => ["assistant", "admin/ai-conversations"].includes(item.path)),
    );
    expect(aiGroups).toHaveLength(1);
    expect(aiGroups[0]).toMatchObject({
      title: "navigationSideBar.ai",
      icon: "AiMentor",
      isExpandable: true,
    });
    expect(aiGroups[0].restrictedAccessRequirement).toBeUndefined();
    expect(aiGroups[0].items.map(({ label, path }) => ({ label, path }))).toEqual([
      { label: "navigationSideBar.aiAssistant", path: "assistant" },
      { label: "aiConversations.title", path: "admin/ai-conversations" },
    ]);
  });

  it.each<{ permissions: PermissionKey[]; visiblePaths: string[] }>([
    { permissions: [], visiblePaths: ["assistant"] },
    { permissions: [PERMISSIONS.COURSE_READ], visiblePaths: ["assistant"] },
    { permissions: [PERMISSIONS.USER_MANAGE], visiblePaths: ["assistant"] },
    {
      permissions: [PERMISSIONS.AI_THREAD_READ],
      visiblePaths: ["assistant", "admin/ai-conversations"],
    },
  ])(
    "shows Assistant to every authenticated permission set while preserving history oversight: $visiblePaths",
    ({ permissions, visiblePaths }) => {
      const aiGroup = mapNavigationItems(forRoles([SYSTEM_ROLE_SLUGS.ADMIN])).find(
        (group) => group.title === "navigationSideBar.ai",
      )!;
      const groupVisible = matchesRequirement(permissions, aiGroup.restrictedAccessRequirement);
      expect(groupVisible).toBe(visiblePaths.length > 0);
      const visibleItems = groupVisible
        ? aiGroup.items.filter((item) => matchesRequirement(permissions, item.accessRequirement))
        : [];
      expect(visibleItems.map((item) => item.path)).toEqual(visiblePaths);
    },
  );

  it.each([
    [SYSTEM_ROLE_SLUGS.STUDENT],
    [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR],
    [SYSTEM_ROLE_SLUGS.TRAINER],
    [SYSTEM_ROLE_SLUGS.GROUP_MANAGER],
    ["custom-role"],
    [],
  ])("uses a standalone Assistant for non-admin roles %j", (...roleSlugs) => {
    const groups = forRoles(roleSlugs);
    expect(groups.some((group) => group.title === "navigationSideBar.ai")).toBe(false);
    const assistant = groups.find((group) => group.items.some((item) => item.path === "assistant"));
    expect(assistant).toMatchObject({
      isExpandable: false,
      items: [{ path: "assistant", accessRequirement: {} }],
    });
    expect(matchesRequirement([], assistant?.restrictedAccessRequirement)).toBe(true);
    expect(matchesRequirement([], assistant?.items[0].accessRequirement)).toBe(true);
  });

  it("groups multi-role admins while keeping Conversations independently permission-gated", () => {
    const group = forRoles([SYSTEM_ROLE_SLUGS.STUDENT, SYSTEM_ROLE_SLUGS.ADMIN]).find(
      (item) => item.title === "navigationSideBar.ai",
    )!;
    expect(group.isExpandable).toBe(true);
    expect(matchesRequirement([], group.items[0].accessRequirement)).toBe(true);
    expect(matchesRequirement([], group.items[1].accessRequirement)).toBe(false);
    expect(matchesRequirement([PERMISSIONS.AI_THREAD_READ], group.items[1].accessRequirement)).toBe(
      true,
    );
  });

  it("retains a permission-authorized standalone Conversations destination for custom non-admin roles", () => {
    const groups = forRoles(["custom-reviewer"]);
    const conversations = groups.find((group) =>
      group.items.some((item) => item.path === "admin/ai-conversations"),
    )!;
    expect(conversations.isExpandable).toBe(false);
    expect(conversations.items).toHaveLength(1);
    expect(matchesRequirement([], conversations.restrictedAccessRequirement)).toBe(false);
    expect(
      matchesRequirement([PERMISSIONS.AI_THREAD_READ], conversations.restrictedAccessRequirement),
    ).toBe(true);
    expect(
      matchesRequirement([PERMISSIONS.AI_THREAD_READ], conversations.items[0].accessRequirement),
    ).toBe(true);
  });

  it("does not include activity logs in the top-level navigation", () => {
    const groups = getNavigationConfig(t);
    expect(
      groups.flatMap((group) => group.items).some((item) => item.path === "admin/activity-logs"),
    ).toBe(false);
    expect(findMatchingRoute("admin/activity-logs")).toEqual({
      allOf: [PERMISSIONS.ACTIVITY_LOG_READ],
    });
  });
  it.each([false, true])(
    "places competencies after development paths with the same label for every role (personal: %s)",
    (_personal) => {
      const items = getNavigationConfig(
        t,
        true,
        true,
        true,
        false,
        true,
        true,
        false,
        [],
        true,
      ).flatMap((group) => group.items);
      const paths = items.map((item) => item.path);
      expect(paths.indexOf("competencies")).toBe(paths.indexOf("development-paths") + 1);
      expect(paths.indexOf("competencies")).toBeLessThan(paths.indexOf("articles"));
      expect(items.find((item) => item.path === "competencies")).toMatchObject({
        iconName: "Gem",
        label: "competencies.title",
        accessRequirement: routeAccessConfig.competencies,
      });
    },
  );

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
