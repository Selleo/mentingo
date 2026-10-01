import { describe, expect, it } from "vitest";

import { sanitizeCourseDescription } from "./sanitizeCourseDescription";

describe("sanitizeCourseDescription", () => {
  it("removes active embeds and executable markup while preserving formatting", () => {
    const result = sanitizeCourseDescription(
      '<p>Learn <strong>security</strong></p><iframe src="https://attacker.example/payload"></iframe><svg onload="alert(1)"></svg><img src=x onerror="alert(1)"><a href="javascript:alert(1)" onclick="alert(1)">bad link</a>',
    );

    expect(result).toContain("<strong>security</strong>");
    expect(result).not.toMatch(/iframe|svg|img|onerror|onclick|javascript:/i);
    expect(result).toContain("bad link");
  });

  it("preserves ordinary links but removes dangerous link schemes", () => {
    const result = sanitizeCourseDescription(
      '<a href="https://example.com" target="_blank">safe</a><a href="data:text/html,evil">unsafe</a>',
    );

    expect(result).toContain('href="https://example.com"');
    expect(result).not.toContain("data:text/html");
  });
});
