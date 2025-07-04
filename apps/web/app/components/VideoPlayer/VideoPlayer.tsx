import { Pause, SkipBack, SkipForward } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Play } from "~/assets/svgs/actions";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";

import type { VideoPlayerProps } from "./VideoPlayer.types";

export const VideoPlayer = ({ url, onVideoEnded }: VideoPlayerProps) => {
  const { isAdmin } = useUserRole();
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!url) throw new Error("Something went wrong");

  const togglePlay = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  const handleSeek = (seconds: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  };

  const handleVideoEnd = useCallback(() => {
    if (!isAdmin && onVideoEnded) {
      setIsPlaying(false);
      onVideoEnded();
    }
  }, [isAdmin, onVideoEnded]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      handleVideoEnd();
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, [handleVideoEnd]);

  return (
    <div
      className="group relative w-full"
      role="button"
      tabIndex={0}
      onClick={togglePlay}
      onKeyDown={(event) => {
        if (event.key === " ") {
          togglePlay();
        }
      }}
    >
      <video ref={videoRef} width="100%" height="auto">
        <source src={url} />
        <track kind="captions" />
      </video>

      <div
        className={cn("absolute inset-0 bg-black transition-opacity duration-200", {
          "opacity-48": !isPlaying,
          "opacity-0 group-hover:opacity-48": isPlaying,
        })}
      />

      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center gap-20 transition-opacity duration-200",
          {
            "opacity-0 group-hover:opacity-100": isPlaying,
            "opacity-100": !isPlaying,
          },
        )}
      >
        <button
          onClick={handleSeek(-10)}
          className="relative rounded-full p-4 transition-transform duration-200 hover:scale-110"
        >
          <div className="absolute inset-0 rounded-full bg-white opacity-32" />
          <SkipBack className="relative z-10 size-8 text-white" />
        </button>

        <button
          onClick={togglePlay}
          className="relative rounded-full p-4 transition-transform duration-200 hover:scale-110"
        >
          <div className="absolute inset-0 rounded-full bg-white opacity-32" />
          {isPlaying ? (
            <Pause className="relative z-10 size-8 text-white" />
          ) : (
            <Play className="relative z-10 size-8 text-white" />
          )}
        </button>

        <button
          onClick={handleSeek(10)}
          className="relative rounded-full p-4 transition-transform duration-200 hover:scale-110"
        >
          <div className="absolute inset-0 rounded-full bg-white opacity-32" />
          <SkipForward className="relative z-10 size-8 text-white" />
        </button>
      </div>
    </div>
  );
};
