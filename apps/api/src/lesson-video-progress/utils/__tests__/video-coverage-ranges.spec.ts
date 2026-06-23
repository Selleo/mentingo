import {
  countBuckets,
  formatInt4MultirangeLiteral,
  getMaxBucketCount,
  mergeBucketRanges,
  parseInt4Multirange,
  toBucketRanges,
} from "../video-coverage-ranges";

describe("video coverage ranges", () => {
  it("converts watched seconds to clamped bucket ranges", () => {
    expect(
      toBucketRanges({
        watchedRanges: [
          [12.2, 16.9],
          [-5, 2.1],
          [98.1, 120],
          [20, 20],
        ],
        durationSeconds: 100,
        bucketSizeSeconds: 1,
      }),
    ).toEqual([
      [12, 17],
      [0, 3],
      [98, 100],
    ]);
  });

  it("merges overlaps and does not double-count rewatched buckets", () => {
    const mergedRanges = mergeBucketRanges([
      [12, 17],
      [14, 20],
      [30, 35],
      [35, 40],
    ]);

    expect(mergedRanges).toEqual([
      [12, 20],
      [30, 40],
    ]);
    expect(countBuckets(mergedRanges)).toBe(18);
  });

  it("formats and parses int4multirange literals", () => {
    const literal = formatInt4MultirangeLiteral([
      [10, 12],
      [1, 3],
      [2, 5],
    ]);

    expect(literal).toBe("{[1,5),[10,12)}");
    expect(parseInt4Multirange(literal)).toEqual([
      [1, 5],
      [10, 12],
    ]);
  });

  it("uses duration and bucket size to calculate the max bucket count", () => {
    expect(getMaxBucketCount(0, 1)).toBe(1);
    expect(getMaxBucketCount(10.1, 1)).toBe(11);
    expect(getMaxBucketCount(61, 10)).toBe(7);
  });
});
