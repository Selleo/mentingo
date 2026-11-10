import { AUTOMATION_TRIGGER_DEFINITIONS } from "@repo/shared";
import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";

const locales = import.meta.glob("../../../locales/*/translation.json", { eager: true });

describe("email template event labels", () => {
  it.each(Object.entries(locales))(
    "describes the business condition rather than an email audience in %s",
    async (_, resource) => {
      const translation = (resource as { default: Record<string, unknown> }).default;
      const i18n = createInstance();
      await i18n.init({ lng: "test", fallbackLng: false, resources: { test: { translation } } });

      const learnerLabel = i18n.t("emailTemplates.events.user_finished_course");
      const adminLabel = i18n.t("emailTemplates.events.admin_finished_course");

      expect(learnerLabel).not.toBe("emailTemplates.events.user_finished_course");
      expect(adminLabel).not.toBe("emailTemplates.events.admin_finished_course");
      expect(adminLabel).toBe(learnerLabel);
      const completion = AUTOMATION_TRIGGER_DEFINITIONS.find(
        ({ type }) => type === "user_finished_course",
      );
      expect(completion).toBeDefined();
      expect(i18n.t(completion?.labelKey ?? "")).toBe(learnerLabel);
      expect(
        AUTOMATION_TRIGGER_DEFINITIONS.filter(
          ({ type }) => type === "user_finished_course" || type === "admin_finished_course",
        ).map(({ type }) => type),
      ).toEqual(["user_finished_course"]);
    },
  );
});
