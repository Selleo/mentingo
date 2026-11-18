import videojs from "video.js";

import { resolveVideoJsLanguage } from "../videoJsLanguage";

const originalLanguages = { ...videojs.options.languages };

afterEach(() => {
  videojs.options.languages = { ...originalLanguages };
});

describe("resolveVideoJsLanguage", () => {
  it("registers the shipped Video.js dictionary for a supported UI language", () => {
    expect(resolveVideoJsLanguage("pl")).toBe("pl");
    expect(videojs.options.languages.pl.Pause).toBe("Wstrzymaj");
  });

  it("falls back to English when Video.js ships no dictionary for the UI language", () => {
    expect(resolveVideoJsLanguage("lt")).toBe("en");
  });

  it("falls back to English for an unknown language", () => {
    expect(resolveVideoJsLanguage("xx")).toBe("en");
  });
});
