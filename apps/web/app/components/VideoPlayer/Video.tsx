import { VIDEO_EMBED_PROVIDERS } from "@repo/shared";
import { useCallback, useMemo, useState } from "react";

import { useThumbnail } from "~/api/queries/useThumbnail";
import { Icon } from "~/components/Icon";

import {
  DEFAULT_VIDEO_ASPECT_RATIO,
  formatVideoAspectRatio,
  getVideoAspectRatio,
  isVerticalVideoAspectRatio,
} from "./aspectRatio";
import { VideoPlayer } from "./VideoPlayer";

import type { VideoCoverageTrackingOptions } from "./videoCoverage.types";
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

  const { data: thumbnailUrl } = useThumbnail(src, provider);

  const resolvedUrl = src ?? url ?? null;
  const resolvedProvider = provider ?? null;

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
    </div>
  );
}
