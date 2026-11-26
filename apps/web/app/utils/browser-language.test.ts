import { afterEach, describe, expect, it, vi } from "vitest";

import { getInitialLanguage, LANGUAGE_STORAGE_KEY } from "./browser-language";

describe("getInitialLanguage", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("uses the language persisted by the language store", () => {
    localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      JSON.stringify({ state: { language: "es" }, version: 0 }),
    );
    vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE");

    expect(getInitialLanguage()).toBe("es");
  });

  it("falls back to the browser language when nothing is persisted", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("es-MX");

    expect(getInitialLanguage()).toBe("es");
  });

  it("ignores unsupported or malformed persisted values", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("fr-FR");

    localStorage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify({ state: { language: "xx" } }));
    expect(getInitialLanguage()).toBe("fr");

    localStorage.setItem(LANGUAGE_STORAGE_KEY, "{not json");
    expect(getInitialLanguage()).toBe("fr");
  });

  it("falls back to English for unsupported browser languages", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("ja-JP");

    expect(getInitialLanguage()).toBe("en");
  });
});
