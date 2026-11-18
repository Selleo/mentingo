import { describe, expect, it } from "vitest";

import { formatPageTitle, getPlatformName } from "./setPageTitle";

describe("getPlatformName", () => {
  it("prefers the company short name", () => {
    expect(getPlatformName({ companyShortName: "PS", companyName: "Premia społeczna" })).toBe("PS");
  });

  it("falls back to the company name when the short name is blank", () => {
    expect(getPlatformName({ companyShortName: " ", companyName: "Premia społeczna" })).toBe(
      "Premia społeczna",
    );
  });

  it("falls back to Mentingo without company information", () => {
    expect(getPlatformName({ companyShortName: "", companyName: "" })).toBe("Mentingo");
    expect(getPlatformName(undefined)).toBe("Mentingo");
  });
});

describe("formatPageTitle", () => {
  it("puts the page first and the platform last", () => {
    expect(formatPageTitle(["Lesson 1", "Course A"], "Acme")).toBe("Lesson 1 – Course A – Acme");
  });

  it("skips missing parts", () => {
    expect(formatPageTitle([undefined, "Course A"], "Acme")).toBe("Course A – Acme");
    expect(formatPageTitle([], "Acme")).toBe("Acme");
  });
});
