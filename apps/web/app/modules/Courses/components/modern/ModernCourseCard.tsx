import { Link } from "@remix-run/react";
import { BookOpen, Clock, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { cn } from "~/lib/utils";

import { formatDuration } from "./utils";

type ModernCourseCardProps = {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  trailerUrl?: string | null;
  estimatedDurationMinutes?: number;
  lessonCount?: number;
  progressPercent?: number;
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
  className,
}: ModernCourseCardProps) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const durationLabel = formatDuration(estimatedDurationMinutes);

  const lessonsLabel = lessonCount
    ? t("studentCoursesView.modernView.lessonsCount", { count: lessonCount })
    : undefined;

  const showProgress = progressPercent && progressPercent > 0;

  useEffect(() => {
    if (!videoRef.current) return;

    if (isHovered) {
      videoRef.current.currentTime = 0;
      const playPromise = videoRef.current.play();

      if (playPromise !== undefined) {
        playPromise.catch(() => undefined);
      }
    } else {
      videoRef.current.pause();
    }
  }, [isHovered]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(true), 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(false), 120);
  };

  return (
    <div
      className={cn("group relative block w-full max-w-sm cursor-pointer", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link to={`/course/${id}`} className="block">
        <div className="relative aspect-video overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md transition-transform duration-300 group-hover:-translate-y-1">
          {trailerUrl ? (
            <>
              <img
                src={thumbnailUrl || DefaultPhotoCourse}
                alt={title}
                className={cn(
                  "h-full w-full object-cover transition-opacity duration-300",
                  isHovered ? "opacity-0" : "opacity-100",
                )}
                onError={(event) => {
                  (event.target as HTMLImageElement).src = DefaultPhotoCourse;
                }}
              />
              <video
                ref={videoRef}
                src={trailerUrl}
                className={cn(
                  "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                  isHovered ? "opacity-100" : "opacity-0",
                )}
                muted
                loop
                playsInline
              />
            </>
          ) : (
            <img
              src={thumbnailUrl || DefaultPhotoCourse}
              alt={title}
              className="h-full w-full object-cover"
              onError={(event) => {
                (event.target as HTMLImageElement).src = DefaultPhotoCourse;
              }}
            />
          )}

          {showProgress && (
            <div className="absolute bottom-0 left-0 right-0 z-30 h-1 bg-white/20">
              <div
                className="h-full bg-red-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/100 via-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="line-clamp-2 text-base font-semibold text-white drop-shadow-lg">
              {title}
            </h3>
          </div>
        </div>
      </Link>

      <Link
        to={`/course/${id}`}
        className={cn(
          "absolute left-1/2 top-0 z-50 w-full -translate-x-1/2 rounded-xl border border-gray-200 bg-white shadow-2xl transition-all duration-200 ease-out",
          isHovered
            ? "-translate-y-1/4 scale-[1.05] opacity-100 pointer-events-auto"
            : "-translate-y-2 scale-100 opacity-0 pointer-events-none",
        )}
      >
        <div className="relative aspect-video overflow-hidden rounded-t-xl">
          {trailerUrl ? (
            <>
              <img
                src={thumbnailUrl || DefaultPhotoCourse}
                alt={title}
                className={cn(
                  "h-full w-full object-cover transition-opacity duration-300",
                  isHovered ? "opacity-0" : "opacity-100",
                )}
                onError={(event) => {
                  (event.target as HTMLImageElement).src = DefaultPhotoCourse;
                }}
              />
              <video
                ref={videoRef}
                src={trailerUrl}
                className={cn(
                  "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                  isHovered ? "opacity-100" : "opacity-0",
                )}
                muted
                loop
                playsInline
              />
            </>
          ) : (
            <img
              src={thumbnailUrl || DefaultPhotoCourse}
              alt={title}
              className="h-full w-full object-cover"
              onError={(event) => {
                (event.target as HTMLImageElement).src = DefaultPhotoCourse;
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-white drop-shadow-lg">
              {title}
            </h3>
          </div>
        </div>

        <div className="space-y-3 rounded-b-xl bg-white p-4">
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

          {description && <p className="line-clamp-3 text-sm text-neutral-700">{description}</p>}

          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white shadow-md">
              <Play className="h-4 w-4" fill="currentColor" />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default ModernCourseCard;
