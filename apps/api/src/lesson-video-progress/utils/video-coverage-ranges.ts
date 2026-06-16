import {
  countVideoCoverageRangeUnits,
  getVideoCoverageMaxBucketCount,
  mergeVideoCoverageRanges,
  toVideoCoverageBucketRanges,
} from "@repo/shared";

import type { VideoCoverageBucketRange } from "@repo/shared";

export type VideoBucketRange = VideoCoverageBucketRange;

export const getMaxBucketCount = getVideoCoverageMaxBucketCount;

export const toBucketRanges = toVideoCoverageBucketRanges;

export const mergeBucketRanges = mergeVideoCoverageRanges<VideoBucketRange>;

export const countBuckets = countVideoCoverageRangeUnits;

export const formatInt4MultirangeLiteral = (ranges: VideoBucketRange[]) => {
  const mergedRanges = mergeBucketRanges(ranges);
  if (!mergedRanges.length) return "{}";

  return `{${mergedRanges.map(([start, end]) => `[${start},${end})`).join(",")}}`;
};

export const parseInt4Multirange = (value: string | null | undefined): VideoBucketRange[] => {
  if (!value || value === "{}") return [];

  return [...value.matchAll(/\[(\d+),(\d+)\)/g)]
    .map((match) => [Number(match[1]), Number(match[2])] as VideoBucketRange)
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start);
};
