import { useCallback, useEffect, useRef, useState } from "react";

import { useThumbnail } from "~/api/queries/useThumbnail";
import { Icon } from "~/components/Icon";
import { useVideoPreferencesStore } from "~/modules/common/store/useVideoPreferencesStore";

import { shouldAutoTriggerVideo } from "./autoplayFlow";
import { useVideoPlayer } from "./VideoPlayerContext";

import type { VideoAutoplay } from "@repo/shared";
import type { KeyboardEvent } from "react";
import type { VideoProvider } from "~/components/RichText/extensions/utils/video";

type Props = {
  src?: string | null;
  url?: string | null;
  provider?: VideoProvider;
  autoplay: VideoAutoplay;
  index?: number | null;
  isExternal?: boolean;
  isExternalUrl?: boolean;
  onVideoEnded?: () => void;
};

export function Video({
  src,
  url,
  provider,
  isExternal,
  isExternalUrl = false,
  onVideoEnded,
  autoplay,
  index,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);
  const { setVideo, setPlaceholderElement, registerVideoActivator, state } = useVideoPlayer();

  const { autoplay: autoplayEnabled, setAutoplaySettings } = useVideoPreferencesStore();

  const { data: thumbnailUrl } = useThumbnail(src, provider);

  const resolvedUrl = src ?? url ?? null;
  const resolvedProvider = provider ?? null;
  const resolvedExternal = isExternal ?? isExternalUrl;
  const resolvedIndex = index ?? null;

  const matchesCurrentVideo =
    !!resolvedUrl &&
    state.currentUrl === resolvedUrl &&
    state.isExternal === resolvedExternal &&
    state.index === resolvedIndex;

  const isActive = matchesCurrentVideo && state.placeholderElement === ref.current;

  const handleActivate = useCallback(() => {
    if (!resolvedUrl) return;

    setVideo(resolvedUrl, resolvedProvider, resolvedExternal, onVideoEnded, resolvedIndex);
    setAutoplaySettings({ currentAction: autoplay });

    setPlaceholderElement(ref.current);
  }, [
    resolvedUrl,
    resolvedProvider,
    setVideo,
    resolvedExternal,
    onVideoEnded,
    resolvedIndex,
    setAutoplaySettings,
    autoplay,
    setPlaceholderElement,
  ]);

  useEffect(() => {
    if (!resolvedUrl) return;

    return registerVideoActivator(resolvedUrl, handleActivate);
  }, [resolvedUrl, registerVideoActivator, handleActivate]);

  useEffect(() => {
    if (!resolvedUrl) return;

    setHasAutoTriggered(false);
  }, [resolvedUrl, autoplay, autoplayEnabled]);

  useEffect(() => {
    if (!resolvedUrl) return;

    if (
      shouldAutoTriggerVideo({
        autoplayEnabled,
        action: autoplay,
        isActive,
      })
    ) {
      if (hasAutoTriggered) return;
      setHasAutoTriggered(true);
      handleActivate();
    }
  }, [resolvedUrl, autoplayEnabled, autoplay, isActive, handleActivate, hasAutoTriggered]);

  useEffect(() => {
    if (!resolvedUrl) return;

    const placeholderIsDetached =
      !!state.placeholderElement && !document.contains(state.placeholderElement);

    if (
      matchesCurrentVideo &&
      state.placeholderElement !== ref.current &&
      (!state.placeholderElement || placeholderIsDetached)
    ) {
      setPlaceholderElement(ref.current);
    }
  }, [resolvedUrl, matchesCurrentVideo, state.placeholderElement, setPlaceholderElement]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handleActivate();
    },
    [handleActivate],
  );

  return (
    <div
      ref={ref}
      className="w-full aspect-video cursor-pointer relative"
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={resolvedUrl && !isActive ? 0 : -1}
      aria-pressed={isActive}
    >
      {!isActive && (
        <div className="absolute size-full bg-gray-600/40 grid place-items-center">
          <span className="text-white h1">
            <Icon name="Play" className="size-24  " />
          </span>
        </div>
      )}

      {thumbnailUrl?.url && (
        <img
          src={thumbnailUrl?.url}
          alt={thumbnailUrl?.url}
          className="w-full aspect-video object-cover"
        />
      )}
    </div>
  );
}
