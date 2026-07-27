import { describe, expect, it } from "vitest";

import { DEFAULT_EMAIL_TEMPLATE_ID, EMAIL_TEMPLATES } from "../emailTemplates.constants";

describe("emailTemplates.constants", () => {
  it("exports a non-empty array of templates", () => {
    expect(EMAIL_TEMPLATES.length).toBeGreaterThan(0);
  });

  it("every template has a unique id", () => {
    const ids = EMAIL_TEMPLATES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("every template has a labelKey string", () => {
    for (const template of EMAIL_TEMPLATES) {
      expect(template.labelKey).toBeTruthy();
      expect(typeof template.labelKey).toBe("string");
    }
  });

  it("every template has a placeholders array", () => {
    for (const template of EMAIL_TEMPLATES) {
      expect(Array.isArray(template.placeholders)).toBe(true);
    }
  });

  it("DEFAULT_EMAIL_TEMPLATE_ID references an existing template", () => {
    const found = EMAIL_TEMPLATES.find((t) => t.id === DEFAULT_EMAIL_TEMPLATE_ID);
    expect(found).toBeDefined();
  });

  it("default email template has no required placeholders", () => {
    const defaultTemplate = EMAIL_TEMPLATES.find((t) => t.id === DEFAULT_EMAIL_TEMPLATE_ID)!;
    expect(defaultTemplate.placeholders).toEqual([]);
  });

  it("user_invite template requires invitedByUserName and createPasswordLink", () => {
    const template = EMAIL_TEMPLATES.find((t) => t.id === "user_invite")!;
    expect(template.placeholders).toContain("invitedByUserName");
    expect(template.placeholders).toContain("createPasswordLink");
  });

  // TODO: Validate actual email template rendering once email templates are finalized
  // The following templates are defined but their HTML rendering is not yet complete:
  // - user_invite, welcome, user_first_login, user_assigned_to_course,
  //   user_short_inactivity, user_long_inactivity, user_finished_chapter,
  //   user_finished_course, create_password_reminder, certificate_expiration_warning,
  //   certificate_expired, announcement, course_due_date_reminder, new_user, finished_course
});
