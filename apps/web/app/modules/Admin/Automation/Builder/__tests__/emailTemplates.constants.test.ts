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
});
