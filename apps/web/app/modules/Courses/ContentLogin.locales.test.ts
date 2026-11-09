import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";

const locales = import.meta.glob<{ default: Record<string, unknown> }>(
  "../../locales/*/translation.json",
  { eager: true },
);
const keys = [
  "studentCoursesView.courseUnavailable.accessTitle",
  "studentCoursesView.courseUnavailable.accessDescription",
  "studentCoursesView.courseUnavailable.goToLogin",
  "studentLessonView.error.loginTitle",
  "studentLessonView.error.loginDescription",
];

describe("content login translations", () => {
  it.each(Object.entries(locales))(
    "resolves localized login prompts in %s without fallback",
    async (path, resource) => {
      const language = path.split("/").at(-2)!;
      const i18n = createInstance();
      await i18n.init({
        lng: language,
        fallbackLng: false,
        resources: { [language]: { translation: resource.default } },
      });
      const englishI18n = createInstance();
      await englishI18n.init({
        lng: "en",
        resources: { en: { translation: locales["../../locales/en/translation.json"].default } },
      });
      for (const key of keys) {
        expect(i18n.exists(key)).toBe(true);
        expect(i18n.t(key)).not.toBe(key);
        expect(i18n.t(key).trim().length).toBeGreaterThan(0);
        if (language !== "en") expect(i18n.t(key)).not.toBe(englishI18n.t(key));
      }
    },
  );
});
