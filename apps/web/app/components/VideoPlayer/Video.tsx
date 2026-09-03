import { VIDEO_EMBED_PROVIDERS } from "@repo/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

const VIDEO_PAUSE_EVENT = "mentingo:lesson-videos-pause";
const VIDEO_RESUME_EVENT = "mentingo:lesson-video-resume";

type ResumeVideoEvent = CustomEvent<{ resourceEntityId: string; requestId: number }>;

let playbackRequestId = 0;

export const pauseAllLessonVideos = () => {
  if (typeof window === "undefined") return;

  playbackRequestId += 1;
  window.dispatchEvent(new CustomEvent(VIDEO_PAUSE_EVENT, { detail: playbackRequestId }));
};

export const resumeLessonVideo = (resourceEntityId: string) => {
  if (typeof window === "undefined") return;

  playbackRequestId += 1;
  window.dispatchEvent(
    new CustomEvent<ResumeVideoEvent["detail"]>(VIDEO_RESUME_EVENT, {
      detail: { resourceEntityId, requestId: playbackRequestId },
    }),
  );
};

export function Video({ src, url, provider, index = null, onEnded, coverageTracking }: Props) {
  const [isActive, setIsActive] = useState(false);
  const [pauseRequestId, setPauseRequestId] = useState<number>();
  const [resumeRequestId, setResumeRequestId] = useState<number>();
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_VIDEO_ASPECT_RATIO);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { data: thumbnailUrl } = useThumbnail(src, provider);

  const resolvedUrl = src ?? url ?? null;
  const resolvedProvider = provider ?? null;

  const handleActivate = useCallback(() => {
    if (!resolvedUrl) return;

    setIsActive(true);

    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

    if (coverageTracking?.resourceEntityId) {
      coverageTracking.onVideoActivated?.(coverageTracking.resourceEntityId);
    }
  }, [coverageTracking, resolvedUrl]);

  useEffect(() => {
    const handlePause = (event: Event) => {
      setPauseRequestId((event as CustomEvent<number>).detail);
    };

    const handleResume = (event: Event) => {
      const detail = (event as ResumeVideoEvent).detail;
      if (detail.resourceEntityId !== coverageTracking?.resourceEntityId) return;

      setResumeRequestId(detail.requestId);
      handleActivate();
    };

    window.addEventListener(VIDEO_PAUSE_EVENT, handlePause);
    window.addEventListener(VIDEO_RESUME_EVENT, handleResume);

    return () => {
      window.removeEventListener(VIDEO_PAUSE_EVENT, handlePause);
      window.removeEventListener(VIDEO_RESUME_EVENT, handleResume);
    };
  }, [coverageTracking?.resourceEntityId, handleActivate]);

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
    <div ref={containerRef} className="w-full">
      <div className="relative w-full overflow-hidden rounded-none bg-black" style={wrapperStyle}>
        {isActive && resolvedUrl ? (
          <div className="relative size-full rounded-none bg-black">
            <VideoPlayer
              provider={resolvedProvider ?? VIDEO_EMBED_PROVIDERS.UNKNOWN}
              url={resolvedUrl}
              autoPlay
              focusOnMount
              onAspectRatioChange={setAspectRatio}
              onEnded={handleEnded}
              coverageTracking={coverageTracking}
              pauseRequestId={pauseRequestId}
              resumeRequestId={resumeRequestId}
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
