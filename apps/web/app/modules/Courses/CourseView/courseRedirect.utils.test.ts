import { describe, expect, it } from "vitest";

import { buildCourseRedirectPath } from "./courseRedirect.utils";

describe("buildCourseRedirectPath", () => {
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
});
