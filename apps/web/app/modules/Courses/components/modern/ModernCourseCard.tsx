import { Link } from "@remix-run/react";
import { BookOpen, Clock, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { cn } from "~/lib/utils";

import { formatDuration } from "./utils";

const isEmbedUrl = (url: string): boolean => {
  return url.includes("iframe.mediadelivery.net/embed") || url.includes("youtube.com/embed");
};

const getEmbedUrlWithParams = (url: string): string => {
  const separator = url.includes("?") ? "&" : "?";
  const params =
    "autoplay=true&muted=true&loop=true&preload=true&controls=0&rel=0&modestbranding=1";
  return `${url}${separator}${params}`;
};

type ModernCourseCardProps = {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  trailerUrl?: string | null;
  estimatedDurationMinutes?: number;
  lessonCount?: number;
  progressPercent?: number;
  category: string | null;
  className?: string;
};

const ModernCourseCard = ({
  id,
  title,
  description,
  thumbnailUrl,
  trailerUrl,
  estimatedDurationMinutes,
  lessonCount,
  progressPercent,
  category,
  className,
}: ModernCourseCardProps) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const durationLabel = formatDuration(estimatedDurationMinutes);

  const lessonsLabel = lessonCount
    ? t("studentCoursesView.modernView.lessonsCount", { count: lessonCount })
    : undefined;

  const showProgress = progressPercent && progressPercent > 0;

  const isEmbed = useMemo(() => trailerUrl && isEmbedUrl(trailerUrl), [trailerUrl]);
  const embedSrc = useMemo(
    () => (trailerUrl && isEmbed ? getEmbedUrlWithParams(trailerUrl) : null),
    [trailerUrl, isEmbed],
  );

  useEffect(() => {
    if (isEmbed || !trailerUrl) return;
    videoRef.current?.load();
  }, [trailerUrl, isEmbed]);

  useEffect(() => {
    if (!videoRef.current || isEmbed) return;

    if (isHovered) {
      videoRef.current.currentTime = 0;
      const playPromise = videoRef.current.play();

      if (playPromise !== undefined) {
        playPromise.catch(() => undefined);
      }
    } else {
      videoRef.current.pause();
    }
  }, [isHovered, isEmbed]);

  useEffect(() => {
    if (isHovered && trailerUrl) {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }

      preloadTimeoutRef.current = setTimeout(() => {
        setShowVideo(true);
      }, 1000);
    } else {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
      setShowVideo(false);
      setIsIframeLoaded(false);
    }

    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, [isHovered, trailerUrl]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(true), 220);
    setShowVideo(false);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(false);
    setShowVideo(false);
  };

  return (
    <div
      className={cn(
        "group relative block w-full max-w-md cursor-pointer overflow-visible",
        className,
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="aspect-video w-full" />

      <Link
        to={`/course/${id}`}
        className="absolute inset-0 transition-all duration-500 ease-out"
        style={{
          transform: isHovered ? "scale(1.05) translateY(-35%)" : "scale(1)",
          transformOrigin: "center center",
          zIndex: isHovered ? 50 : 1,
        }}
        tabIndex={0}
      >
        <div className="relative aspect-video overflow-hidden border border-gray-200 bg-white shadow-md transition-all duration-300">
          {trailerUrl ? (
            <>
              <div
                className={cn(
                  "absolute inset-0 transition-opacity duration-300",
                  isHovered && showVideo ? "opacity-0" : "opacity-100",
                )}
              >
                <img
                  src={thumbnailUrl || DefaultPhotoCourse}
                  alt={title}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    (event.target as HTMLImageElement).src = DefaultPhotoCourse;
                  }}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none"
                />
              </div>
              {isEmbed && embedSrc ? (
                <iframe
                  src={isHovered ? embedSrc : undefined}
                  className={cn(
                    "absolute inset-0 h-full w-full border-0 transition-opacity duration-300",
                    isHovered && showVideo && isIframeLoaded ? "opacity-100" : "opacity-0",
                  )}
                  allow="autoplay; encrypted-media"
                  title={title}
                  onLoad={() => setIsIframeLoaded(true)}
                />
              ) : (
                <video
                  ref={videoRef}
                  src={trailerUrl}
                  preload="auto"
                  className={cn(
                    "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                    isHovered && showVideo ? "opacity-100" : "opacity-0",
                  )}
                  muted
                  loop
                  playsInline
                  autoPlay
                  controls={false}
                />
              )}
            </>
          ) : (
            <div className="absolute inset-0">
              <img
                src={thumbnailUrl || DefaultPhotoCourse}
                alt={title}
                className="h-full w-full object-cover"
                onError={(event) => {
                  (event.target as HTMLImageElement).src = DefaultPhotoCourse;
                }}
              />
              <div
                aria-hidden
                className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none"
              />
            </div>
          )}

          {showProgress && (
            <div className="absolute bottom-0 left-0 right-0 z-30 h-1 bg-white/20">
              <div
                className="h-full bg-red-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          <div
            className="absolute bottom-0 left-0 right-0 z-20 p-4 transition-opacity duration-300"
            style={{ opacity: isHovered ? 0 : 1 }}
          >
            <h3 className="line-clamp-2 text-base font-semibold text-white drop-shadow-lg">
              {title}
            </h3>
          </div>
        </div>

        <div
          className="overflow-hidden rounded-b-lg bg-white shadow-xl transition-all duration-300"
          style={{
            maxHeight: isHovered ? "220px" : "0px",
            opacity: isHovered ? 1 : 0,
          }}
        >
          <div className="space-y-3 border border-t-0 border-gray-200 p-4">
            <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-gray-900 transition-all duration-300">
              {title}
            </h3>

            {(durationLabel || lessonsLabel) && (
              <div className="flex items-center gap-4 text-xs text-neutral-700">
                {durationLabel && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{durationLabel}</span>
                  </div>
                )}
                {lessonsLabel && (
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>{lessonsLabel}</span>
                  </div>
                )}
              </div>
            )}

            {description && <p className="line-clamp-2 text-xs text-neutral-600">{description}</p>}

            <div className="flex items-center justify-between">
              <span className="rounded bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white">
                {category}
              </span>

              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white shadow-md transition-transform duration-200 group-hover:scale-110">
                <Play className="h-4 w-4" fill="currentColor" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default ModernCourseCard;
