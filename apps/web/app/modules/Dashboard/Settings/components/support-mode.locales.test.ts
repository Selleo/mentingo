import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";

const locales = import.meta.glob<{ default: Record<string, unknown> }>(
  "../../../../locales/*/translation.json",
  { eager: true },
);

const key = "supportMode.errors.personalSettingsBlocked";

describe("support-mode personal settings error", () => {
  it.each(Object.entries(locales))("resolves the error message in %s", async (path, locale) => {
    const language = path.split("/").at(-2)!;
    const i18n = createInstance();
    await i18n.init({
      lng: language,
      fallbackLng: false,
      resources: { [language]: { translation: locale.default } },
    });
    expect(i18n.exists(key)).toBe(true);
    expect(i18n.t(key)).not.toBe(key);
    if (language === "pl") {
      expect(i18n.t(key)).toBe("Nie można zmieniać ustawień osobistych w trybie wsparcia.");
    }
  });
});
