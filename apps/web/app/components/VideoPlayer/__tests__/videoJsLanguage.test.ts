import videojs from "video.js";

import { registerVideoJsLanguage } from "../videoJsLanguage";

describe("registerVideoJsLanguage", () => {
  it("registers the shipped Video.js dictionary for a supported UI language", () => {
    expect(registerVideoJsLanguage("pl")).toBe("pl");
    expect(videojs.options.languages.pl.Pause).toBe("Wstrzymaj");
  });

  it("falls back to English when Video.js ships no dictionary for the UI language", () => {
    expect(registerVideoJsLanguage("lt")).toBe("en");
  });

  it("falls back to English for an unknown language", () => {
    expect(registerVideoJsLanguage("xx")).toBe("en");
  });
});
