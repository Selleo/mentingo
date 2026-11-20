import { WCAG_LEVEL_TAGS } from "./wcag-level-tags";

describe("WCAG_LEVEL_TAGS", () => {
  it("maps each level to its cumulative axe-core tags", () => {
    expect(WCAG_LEVEL_TAGS).toEqual({
      A: ["wcag2a", "wcag21a"],
      AA: ["wcag2a", "wcag21a", "wcag2aa", "wcag21aa", "wcag22aa"],
      AAA: ["wcag2a", "wcag21a", "wcag2aa", "wcag21aa", "wcag22aa", "wcag2aaa"],
    });
  });
});
