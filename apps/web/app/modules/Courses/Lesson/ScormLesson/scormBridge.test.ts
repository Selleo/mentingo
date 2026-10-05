import { describe, expect, it } from "vitest";

import { parseScormLaunch } from "./scormBridge";

describe("SCORM isolated bridge", () => {
  it("accepts only a different HTTPS origin and an exact token player path", () => {
    const valid = `https://scorm.example/api/scorm/delivery/${"a".repeat(64)}/player`;
    expect(parseScormLaunch(valid, "https://lms.example")).toEqual({
      origin: "https://scorm.example",
      channel: "a".repeat(64),
    });
    for (const url of [
      valid.replace("https:", "http:"),
      valid.replace("scorm.example", "lms.example"),
      valid + "/anything",
      valid + "?redirect=1",
      valid.replace("/player", "/assets/index.html"),
    ]) {
      expect(parseScormLaunch(url, "https://lms.example")).toBeNull();
    }
  });
});
