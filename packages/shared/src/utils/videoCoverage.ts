export type VideoCoverageRange = [number, number];

export type VideoCoverageBucketRange = [number, number];

export const isVideoCoverageRange = (value: unknown): value is VideoCoverageRange =>
  Array.isArray(value) &&
  value.length === 2 &&
  Number.isFinite(value[0]) &&
  Number.isFinite(value[1]) &&
  value[1] > value[0];

export const parseVideoCoverageRanges = (
  value: VideoCoverageRange[] | string | null | undefined,
) => {
  if (Array.isArray(value)) {
    return value.filter(isVideoCoverageRange);
  }

  if (!value) return [];

  try {
    const parsedValue: unknown = JSON.parse(value);
    return Array.isArray(parsedValue) ? parsedValue.filter(isVideoCoverageRange) : [];
  } catch {
    return [];
  }
};

export const mergeVideoCoverageRanges = <TRange extends VideoCoverageRange>(
  ranges: TRange[],
): TRange[] => {
  const sortedRanges = ranges
    .filter(isVideoCoverageRange)
    .map(([start, end]) => [Math.max(0, start), Math.max(0, end)] as TRange)
    .filter(isVideoCoverageRange)
    .sort(([startA, endA], [startB, endB]) => {
      if (startA !== startB) return startA - startB;
      return endA - endB;
    });

  const mergedRanges: TRange[] = [];

  for (const [start, end] of sortedRanges) {
    const previous = mergedRanges.at(-1);

    if (!previous || start > previous[1]) {
      mergedRanges.push([start, end] as TRange);
      continue;
    }

    mergedRanges[mergedRanges.length - 1] = [previous[0], Math.max(previous[1], end)] as TRange;
  }

  return mergedRanges;
};

export const countVideoCoverageRangeUnits = (ranges: VideoCoverageRange[]) =>
  ranges.reduce((total, [start, end]) => total + Math.max(0, end - start), 0);

export const getVideoCoverageMaxBucketCount = (
  durationSeconds: number,
  bucketSizeSeconds: number,
) => Math.max(1, Math.ceil(durationSeconds / bucketSizeSeconds));

export const bucketizeVideoCoverageTimeRange = ({
  startSeconds,
  endSeconds,
  bucketSizeSeconds,
}: {
  startSeconds: number;
  endSeconds: number;
  bucketSizeSeconds: number;
}): VideoCoverageRange | null => {
  const start =
    Math.floor(Math.min(startSeconds, endSeconds) / bucketSizeSeconds) * bucketSizeSeconds;
  const end = Math.ceil(Math.max(startSeconds, endSeconds) / bucketSizeSeconds) * bucketSizeSeconds;

  if (end <= start) return null;

  return [start, end];
};

export const toVideoCoverageBucketRanges = ({
  watchedRanges,
  durationSeconds,
  bucketSizeSeconds,
}: {
  watchedRanges: VideoCoverageRange[];
  durationSeconds: number;
  bucketSizeSeconds: number;
}): VideoCoverageBucketRange[] => {
  const maxBucketCount = getVideoCoverageMaxBucketCount(durationSeconds, bucketSizeSeconds);

  return watchedRanges
    .map(([startSeconds, endSeconds]) => {
      const startBucket = Math.max(0, Math.floor(startSeconds / bucketSizeSeconds));
      const endBucket = Math.min(maxBucketCount, Math.ceil(endSeconds / bucketSizeSeconds));

      return [startBucket, endBucket] as VideoCoverageBucketRange;
    })
    .filter(([startBucket, endBucket]) => endBucket > startBucket);
};
