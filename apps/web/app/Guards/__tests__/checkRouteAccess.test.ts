import { PERMISSIONS } from "@repo/shared";

import { checkRouteAccess } from "../RouteGuard";

describe("checkRouteAccess", () => {
  it("allows workspace access for each tab permission", () => {
    for (const permission of [
      PERMISSIONS.AUTOMATION_MANAGE,
      PERMISSIONS.AUTOMATION_LOG_READ,
      PERMISSIONS.EMAIL_TEMPLATE_MANAGE,
    ]) {
      expect(checkRouteAccess("admin/automations", [permission])).toBe(true);
    }
    expect(checkRouteAccess("admin/automations", [])).toBe(false);
    expect(checkRouteAccess("admin/automations", [PERMISSIONS.USER_MANAGE])).toBe(false);
  });
  it("keeps management and log permissions separate", () => {
    for (const route of ["admin/automations/new", "admin/automations/id"]) {
      expect(checkRouteAccess(route, [PERMISSIONS.AUTOMATION_MANAGE])).toBe(true);
      expect(checkRouteAccess(route, [PERMISSIONS.AUTOMATION_LOG_READ])).toBe(false);
      expect(checkRouteAccess(route, [PERMISSIONS.EMAIL_TEMPLATE_MANAGE])).toBe(false);
    }
    expect(checkRouteAccess("admin/automation-logs", [PERMISSIONS.AUTOMATION_LOG_READ])).toBe(true);
    expect(checkRouteAccess("admin/automation-logs", [PERMISSIONS.AUTOMATION_MANAGE])).toBe(false);
  });
  it("requires email-template permission for every builder route", () => {
    for (const route of [
      "admin/email-templates",
      "admin/email-templates/defaults/welcome",
      "admin/email-templates/template-id",
    ]) {
      expect(checkRouteAccess(route, [PERMISSIONS.EMAIL_TEMPLATE_MANAGE])).toBe(true);
      expect(checkRouteAccess(route, [PERMISSIONS.USER_MANAGE])).toBe(false);
      expect(checkRouteAccess(route, [])).toBe(false);
    }
  });
  it("should allow access to exact matching routes", () => {
    expect(checkRouteAccess("admin/courses", [PERMISSIONS.COURSE_UPDATE])).toBe(true);
    expect(checkRouteAccess("admin/courses", [PERMISSIONS.COURSE_UPDATE_OWN])).toBe(true);
    expect(checkRouteAccess("admin/courses", [PERMISSIONS.COURSE_READ])).toBe(false);
    expect(checkRouteAccess("admin/courses", [PERMISSIONS.MANAGED_GROUP_RESULTS_READ])).toBe(false);
  });

  it("should handle wildcard routes", () => {
    expect(checkRouteAccess("admin/users", [PERMISSIONS.USER_MANAGE])).toBe(true);
    expect(checkRouteAccess("admin/users/123", [PERMISSIONS.USER_MANAGE])).toBe(true);
    expect(checkRouteAccess("admin/users/new", [PERMISSIONS.USER_MANAGE])).toBe(true);
    expect(checkRouteAccess("admin/users", [PERMISSIONS.COURSE_UPDATE_OWN])).toBe(false);
  });

  it("should handle public routes", () => {
    expect(checkRouteAccess("auth/login", [PERMISSIONS.USER_MANAGE])).toBe(true);
    expect(checkRouteAccess("auth/login", [PERMISSIONS.COURSE_UPDATE_OWN])).toBe(true);
    expect(checkRouteAccess("auth/login", [PERMISSIONS.COURSE_READ])).toBe(true);
  });

  it("should deny access to non-existing routes", () => {
    expect(checkRouteAccess("non/existing/route", [PERMISSIONS.USER_MANAGE])).toBe(false);
  });
});
