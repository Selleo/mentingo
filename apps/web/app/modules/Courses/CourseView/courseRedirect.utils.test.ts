import { describe, expect, it } from "vitest";

import { buildCourseRedirectPath, shouldRedirectToCourseSlug } from "./courseRedirect.utils";

describe("course redirect utils", () => {
  it("preserves the selected language while redirecting to its localized course slug", () => {
    expect(
      buildCourseRedirectPath(
        "https://mentingo.test/course/english-course?language=pl",
        "polski-kurs",
      ),
    ).toBe("/course/polski-kurs?language=pl");
  });

  it("preserves every existing search parameter", () => {
    expect(
      buildCourseRedirectPath(
        "https://mentingo.test/course/english-course?language=pl&source=overview",
        "polski-kurs",
      ),
    ).toBe("/course/polski-kurs?language=pl&source=overview");
  });

  it("redirects UUID course paths to the canonical slug", () => {
    expect(
      shouldRedirectToCourseSlug("b24b7ec4-a8d2-4db2-a5a7-a5f39e346292", "abc12-course-title"),
    ).toBe(true);
  });

  it("keeps an already canonical course slug", () => {
    expect(shouldRedirectToCourseSlug("abc12-course-title", "abc12-course-title")).toBe(false);
  });
});
