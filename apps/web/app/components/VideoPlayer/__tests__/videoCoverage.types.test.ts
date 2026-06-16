import { parseVideoCoverageRanges } from "@repo/shared";
import { describe, expect, it } from "vitest";

describe("parseVideoCoverageRanges", () => {
  it("accepts valid ranges from arrays and JSON attributes", () => {
    expect(
      parseVideoCoverageRanges([
        [0, 5],
        [8, 12],
      ]),
    ).toEqual([
      [0, 5],
      [8, 12],
    ]);

    expect(parseVideoCoverageRanges("[[10,15],[20,25]]")).toEqual([
      [10, 15],
      [20, 25],
    ]);
  });

  it("drops malformed ranges and malformed JSON", () => {
    expect(parseVideoCoverageRanges("[[5,5],[8,3],[1,4],null]")).toEqual([[1, 4]]);
    expect(parseVideoCoverageRanges("not json")).toEqual([]);
    expect(parseVideoCoverageRanges(null)).toEqual([]);
  });
});
