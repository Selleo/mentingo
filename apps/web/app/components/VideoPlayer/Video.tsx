import { VIDEO_EMBED_PROVIDERS } from "@repo/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useThumbnail } from "~/api/queries/useThumbnail";
import { Icon } from "~/components/Icon";

import {
  DEFAULT_VIDEO_ASPECT_RATIO,
  formatVideoAspectRatio,
  getVideoAspectRatio,
  isVerticalVideoAspectRatio,
} from "./aspectRatio";
import { VideoPlayer } from "./VideoPlayer";

import type { VideoCoverageSnapshot, VideoCoverageTrackingOptions } from "./videoCoverage.types";
import type { CSSProperties, KeyboardEvent, SyntheticEvent } from "react";
import type { VideoProvider } from "~/components/RichText/extensions/utils/video";

type Props = {
  src?: string | null;
  url?: string | null;
  provider?: VideoProvider;
  index?: number | null;
  onEnded?: (index: number | null) => void;
  coverageTracking?: VideoCoverageTrackingOptions;
};

export function Video({ src, url, provider, index = null, onEnded, coverageTracking }: Props) {
  const [isActive, setIsActive] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_VIDEO_ASPECT_RATIO);
  const [coverage, setCoverage] = useState<VideoCoverageSnapshot | null>(() =>
    coverageTracking?.enabled
      ? {
          coveragePercent: coverageTracking.initialCoveragePercent ?? 0,
          watchedRanges: coverageTracking.initialWatchedRanges ?? [],
          isWatched: Boolean(coverageTracking.initialIsWatched),
          durationSeconds: coverageTracking.initialDurationSeconds ?? null,
          bucketSizeSeconds: coverageTracking.initialBucketSizeSeconds ?? 1,
        }
      : null,
  );

  const { data: thumbnailUrl } = useThumbnail(src, provider);

  const resolvedUrl = src ?? url ?? null;
  const resolvedProvider = provider ?? null;

  useEffect(() => {
    if (!coverageTracking?.enabled) {
      setCoverage(null);
      return;
    }

    setCoverage({
      coveragePercent: coverageTracking.initialCoveragePercent ?? 0,
      watchedRanges: coverageTracking.initialWatchedRanges ?? [],
      isWatched: Boolean(coverageTracking.initialIsWatched),
      durationSeconds: coverageTracking.initialDurationSeconds ?? null,
      bucketSizeSeconds: coverageTracking.initialBucketSizeSeconds ?? 1,
    });
  }, [coverageTracking]);

  const handleActivate = useCallback(() => {
    if (!resolvedUrl) return;

    setIsActive(true);
  }, [resolvedUrl]);

  const handleThumbnailLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;

    const videoAspectRatio = getVideoAspectRatio(naturalWidth, naturalHeight);
    if (!videoAspectRatio) return;

    setAspectRatio(videoAspectRatio);
  }, []);

  const handleEnded = useCallback(() => {
    onEnded?.(index);
  }, [index, onEnded]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handleActivate();
    },
    [handleActivate],
  );

  const aspectRatioStyle = useMemo(
    () =>
      ({
        aspectRatio: formatVideoAspectRatio(aspectRatio),
      }) satisfies CSSProperties,
    [aspectRatio],
  );
  const isVerticalVideo = isVerticalVideoAspectRatio(aspectRatio);
  const shouldShowCoverage = Boolean(coverageTracking?.enabled && coverage);
  const coveragePercent = Math.round((coverage?.coveragePercent ?? 0) * 100);
  const clampedCoveragePercent = Math.min(100, Math.max(0, coveragePercent));
  const wrapperStyle = useMemo(
    () =>
      ({
        ...aspectRatioStyle,
        ...(isVerticalVideo ? { maxHeight: 600 } : {}),
      }) satisfies CSSProperties,
    [aspectRatioStyle, isVerticalVideo],
  );

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden rounded-none bg-black" style={wrapperStyle}>
        {isActive && resolvedUrl ? (
          <div className="relative size-full rounded-none bg-black">
            <VideoPlayer
              provider={resolvedProvider ?? VIDEO_EMBED_PROVIDERS.UNKNOWN}
              url={resolvedUrl}
              autoPlay
              onAspectRatioChange={setAspectRatio}
              onEnded={handleEnded}
              onCoverageChange={setCoverage}
              coverageTracking={coverageTracking}
              className="size-full"
            />
          </div>
        ) : (
          <div
            className="relative size-full cursor-pointer overflow-hidden rounded-none bg-black"
            onClick={handleActivate}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={resolvedUrl ? 0 : -1}
            aria-pressed={isActive}
          >
            <div className="absolute inset-0 z-10 grid place-items-center bg-gray-600/40">
              <span className="text-white h1">
                <Icon name="Play" className="size-24" />
              </span>
            </div>

            {thumbnailUrl?.url && (
              <img
                src={thumbnailUrl.url}
                alt={thumbnailUrl.url}
                onLoad={handleThumbnailLoad}
                className="absolute inset-0 size-full object-contain"
              />
            )}
          </div>
        )}
      </div>
      {shouldShowCoverage && (
        <div
          className="relative h-5 w-full overflow-hidden rounded-b bg-primary/20"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={coveragePercent}
        >
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${clampedCoveragePercent}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-primary-950">
            {coveragePercent}%
          </span>
          <span
            className="absolute inset-0 flex items-center justify-center overflow-hidden text-xs font-semibold text-white"
            style={{ clipPath: `inset(0 ${100 - clampedCoveragePercent}% 0 0)` }}
          >
            {coveragePercent}%
          </span>
        </div>
      )}
    </div>
  );
}
