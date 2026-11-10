import { describe, expect, it } from "vitest";

import { courseReturnPath } from "./courseReturnPath";

describe("courseReturnPath", () => {
  it("accepts a local course route with language query", () => {
    expect(courseReturnPath("?returnTo=%2Fcourse%2Fintro%3Flanguage%3Dpl")).toBe(
      "/course/intro?language=pl",
    );
  });

  it("preserves an exact lesson route, query and hash", () => {
    const path = "/course/course-1/lesson/lesson-1?language=pl&preview=true#section-2";
    expect(courseReturnPath(`?returnTo=${encodeURIComponent(path)}`)).toBe(path);
  });

  it.each([
    "?returnTo=%2Fcourse%2Fintro%2Flesson%2Flesson-1%2Fextra",
    "?returnTo=%2Fcourse%2Fintro%2Flesson%2F",
    "?returnTo=%2Fcourse%2Fintro%2Fadmin%2Flesson-1",
    "?returnTo=%2Fcourse%2Fintro%2Flesson%2F%252e%252e%2Fadmin",
    "?returnTo=%2Fcourse%2Fintro%2Flesson%2Flesson-1%5Cevil",
    "?returnTo=%2Fcourse%2Fintro%2Flesson%2F..%2Fadmin",
    "?returnTo=https%3A%2F%2Fevil.example%2Fcourse%2Fintro",
    "?returnTo=%2F%2Fevil.example%2Fcourse%2Fintro",
    "?returnTo=%2Fauth%2Flogin",
    "?returnTo=%2Fdashboard",
    "?returnTo=%2Fcourse%2F..%2Fadmin",
    "?returnTo=%2Fcourse%2Fintro%5Cevil",
  ])("rejects an unsafe or non-course return path: %s", (search) => {
    expect(courseReturnPath(search)).toBeNull();
  });
});
