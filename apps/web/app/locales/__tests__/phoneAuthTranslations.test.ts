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

const flattenKeys = (value: unknown, prefix = ""): string[] => {
  if (!value || typeof value !== "object") return [prefix];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
    flattenKeys(nested, prefix ? `${prefix}.${key}` : key),
  );
};

const getValue = (translation: unknown, path: string) =>
  path
    .split(".")
    .reduce<unknown>(
      (current, key) => (current as Record<string, unknown> | undefined)?.[key],
      translation,
    );

const phoneAuthKeys = flattenKeys(en.phoneAuth, "phoneAuth");

describe("phone auth translations", () => {
  it.each(Object.entries(locales))("%s defines every phoneAuth key", (_, translation) => {
    for (const key of [...phoneAuthKeys, "adminUserView.field.phone"]) {
      expect(getValue(translation, key), key).toEqual(expect.any(String));
      expect((getValue(translation, key) as string).length, key).toBeGreaterThan(0);
    }
  });

  it("has Russian texts for the login tabs", () => {
    expect(ru.phoneAuth.tabs).toEqual({ email: "По email", phone: "По телефону" });
    expect(ru.phoneAuth.button.getCode).toBe("Получить код");
  });
});
