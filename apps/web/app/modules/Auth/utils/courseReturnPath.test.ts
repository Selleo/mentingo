import { describe, expect, it } from "vitest";

import { courseReturnPath } from "./courseReturnPath";

describe("courseReturnPath", () => {
  it("accepts a local course route with language query", () => {
    expect(courseReturnPath("?returnTo=%2Fcourse%2Fintro%3Flanguage%3Dpl")).toBe(
      "/course/intro?language=pl",
    );
  });

  it.each([
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
