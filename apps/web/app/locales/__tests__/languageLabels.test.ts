import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import cs from "~/locales/cs/translation.json";
import de from "~/locales/de/translation.json";
import en from "~/locales/en/translation.json";
import es from "~/locales/es/translation.json";
import fr from "~/locales/fr/translation.json";
import lt from "~/locales/lt/translation.json";
import pl from "~/locales/pl/translation.json";
import ru from "~/locales/ru/translation.json";

const locales = { cs, de, en, es, fr, lt, pl, ru };

describe("language labels", () => {
  it("has a locale file for every supported language", () => {
    expect(Object.keys(locales).sort()).toEqual(Object.values(SUPPORTED_LANGUAGES).sort());
  });

  it.each(Object.entries(locales))("%s labels every supported language", (_, translation) => {
    const labels = (translation as { common: { languages: Record<string, string> } }).common
      .languages;

    for (const language of Object.values(SUPPORTED_LANGUAGES)) {
      expect(labels[language], `common.languages.${language}`).toBeTruthy();
    }
  });
});
