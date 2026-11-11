import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";

type Status = "draft" | "published" | "private";
type Translation = {
  adminCourseView: { status: Record<`${Status}Header`, string> };
  learningPathsView: { status: Record<Status, string> };
};

const locales = import.meta.glob<{ default: Translation }>("../../locales/*/translation.json", {
  eager: true,
});
const statuses = ["draft", "published", "private"] as const;

describe("learning path publication status translations", () => {
  describe.each(Object.entries(locales))("%s", (path, locale) => {
    it.each(statuses)("matches the course status selector label for %s", async (status) => {
      const language = path.split("/").at(-2)!;
      const i18n = createInstance();
      await i18n.init({
        lng: language,
        fallbackLng: false,
        resources: { [language]: { translation: locale.default } },
      });

      // CourseStatus selects these headers, not the separate course list status labels.
      const courseKey = `adminCourseView.status.${status}Header` as const;
      const learningPathKey = `learningPathsView.status.${status}` as const;
      expect(i18n.exists(courseKey)).toBe(true);
      expect(i18n.exists(learningPathKey)).toBe(true);
      expect(i18n.t(learningPathKey)).toBe(i18n.t(courseKey));
    });
  });
});
