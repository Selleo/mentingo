import { describe, expect, it } from "vitest";

import { isNaturalLanguageQuery, titleExplainsMatch } from "./globalSearchQuery";

describe("isNaturalLanguageQuery", () => {
  it.each([
    ["how do refunds work", true],
    ["refunds?", true],
    ["travel policy", false],
    ["a?", false],
    ["  policy  ", false],
  ])("%j -> %s", (query, expected) => {
    expect(isNaturalLanguageQuery(query)).toBe(expected);
  });
});

describe("titleExplainsMatch", () => {
  it("hides excerpts that only repeat the title", () => {
    expect(titleExplainsMatch("E2E Test: Automated Course", "test")).toBe(true);
    expect(titleExplainsMatch("Travel Policy", "policy travel")).toBe(true);
  });
  it("keeps excerpts that explain a match the title does not show", () => {
    expect(titleExplainsMatch("Onboarding", "reimbursement")).toBe(false);
    expect(titleExplainsMatch("Travel Policy", "policy refunds")).toBe(false);
    expect(titleExplainsMatch("Travel Policy", "an")).toBe(false);
  });
});
