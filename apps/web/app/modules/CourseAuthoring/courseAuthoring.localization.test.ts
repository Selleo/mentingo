import { describe, expect, it } from "vitest";

import cs from "~/locales/cs/translation.json";
import de from "~/locales/de/translation.json";
import en from "~/locales/en/translation.json";
import es from "~/locales/es/translation.json";
import fr from "~/locales/fr/translation.json";
import lt from "~/locales/lt/translation.json";
import pl from "~/locales/pl/translation.json";

const translationsByLocale = { cs, de, en, es, fr, lt, pl } as const;
const flatten = (value: Record<string, unknown>, prefix = "") => {
  const entries: [string, string][] = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") entries.push([path, child]);
    else if (child && typeof child === "object" && !Array.isArray(child)) {
      entries.push(...flatten(child as Record<string, unknown>, path));
    }
  }
  return entries;
};

const placeholders = (value: string) =>
  [...value.matchAll(/{{\s*([^}]+?)\s*}}/g)].map((match) => match[1]).sort();

const englishAuthoring = new Map(
  flatten(en as unknown as Record<string, unknown>).filter(([key]) =>
    key.startsWith("courseAuthoring."),
  ),
);

describe("CourseAuthoring localization", () => {
  it.each(Object.entries(translationsByLocale))(
    "%s has every CourseAuthoring translation",
    (_locale, translation) => {
      const localized = new Map(flatten(translation as unknown as Record<string, unknown>));
      for (const [key] of englishAuthoring) {
        expect(localized.get(key), key).toBeTruthy();
      }
    },
  );

  it.each(Object.entries(translationsByLocale))(
    "%s preserves interpolation placeholders",
    (_locale, translation) => {
      const localized = new Map(flatten(translation as unknown as Record<string, unknown>));
      for (const [key, englishValue] of englishAuthoring) {
        expect(placeholders(localized.get(key) ?? ""), key).toEqual(placeholders(englishValue));
      }
    },
  );

  it.each(Object.entries(translationsByLocale))(
    "%s keeps the CourseAuthoring page title at its stable key",
    (_locale, translation) => {
      expect(translation.courseAuthoring.title).toBeTruthy();
    },
  );
});
