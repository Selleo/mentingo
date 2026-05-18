import { VIDEO_EMBED_PROVIDERS } from "@repo/shared";
import { useCallback, useState } from "react";

import { useThumbnail } from "~/api/queries/useThumbnail";
import { Icon } from "~/components/Icon";

import { VideoPlayer } from "./VideoPlayer";

import type { KeyboardEvent, SyntheticEvent } from "react";
import type { VideoProvider } from "~/components/RichText/extensions/utils/video";

type Props = {
  src?: string | null;
  url?: string | null;
  provider?: VideoProvider;
  index?: number | null;
  onEnded?: (index: number | null) => void;
};

export function Video({ src, url, provider, index = null, onEnded }: Props) {
  const [isActive, setIsActive] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("16 / 9");

  const { data: thumbnailUrl } = useThumbnail(src, provider);

  const resolvedUrl = src ?? url ?? null;
  const resolvedProvider = provider ?? null;

  const handleActivate = useCallback(() => {
    if (!resolvedUrl) return;

    setIsActive(true);
  }, [resolvedUrl]);

  const handleThumbnailLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) return;

    setAspectRatio(`${naturalWidth} / ${naturalHeight}`);
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

  return (
    <div className="relative w-full" style={{ aspectRatio }}>
      {isActive && resolvedUrl ? (
        <div className="relative w-full bg-black" style={{ aspectRatio }}>
          <VideoPlayer
            provider={resolvedProvider ?? VIDEO_EMBED_PROVIDERS.UNKNOWN}
            url={resolvedUrl}
            autoPlay
            onAspectRatioChange={setAspectRatio}
            onEnded={handleEnded}
            className="size-full"
          />
        </div>
      ) : (
        <div
          className="relative w-full cursor-pointer overflow-hidden bg-black"
          style={{ aspectRatio }}
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
              className="absolute inset-0 size-full object-cover"
            />
          )}
        </div>
      )}
    </div>
  );
}
