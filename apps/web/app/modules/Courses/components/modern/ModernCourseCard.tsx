import { Link } from "@remix-run/react";
import { Clock, BookOpen, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { cn } from "~/lib/utils";

import { formatDuration } from "./utils";

type ModernCourseCardProps = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  trailerUrl?: string | null;
  category: string;
  estimatedDurationMinutes?: number;
  lessonCount?: number;
  progressPercent?: number;
  className?: string;
};

const ModernCourseCard = ({
  id,
  title,
  thumbnailUrl,
  trailerUrl,
  category,
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
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 400);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovered(false);
  };

  return (
    <Link
      to={`/course/${id}`}
      className={cn("group relative block w-full max-w-sm", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="aspect-video w-full" />

      <div
        className="absolute inset-0 transition-all duration-500 ease-out"
        style={{
          transform: isHovered ? "scale(1.12) translateY(-18%)" : "scale(1)",
          transformOrigin: "center center",
          zIndex: isHovered ? 50 : 1,
        }}
      >
        <div
          className={cn(
            "relative aspect-video overflow-hidden bg-white shadow-md transition-all duration-300",
            isHovered ? "rounded-t-lg" : "rounded-lg",
          )}
        >
          {trailerUrl ? (
            <>
              <img
                src={thumbnailUrl || DefaultPhotoCourse}
                alt={title}
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
                style={{ opacity: isHovered ? 0 : 1 }}
                onError={(event) => {
                  (event.target as HTMLImageElement).src = DefaultPhotoCourse;
                }}
              />
              <video
                ref={videoRef}
                src={trailerUrl}
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
                style={{ opacity: isHovered ? 1 : 0 }}
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

          {progressPercent !== undefined && progressPercent > 0 && (
            <div className="absolute bottom-0 left-0 right-0 z-30 h-1 bg-white/20">
              <div
                className="h-full bg-red-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          <div
            className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300"
            style={{ opacity: isHovered ? 0 : 1 }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 p-4 transition-opacity duration-300"
            style={{ opacity: isHovered ? 0 : 1 }}
          >
            <h3 className="line-clamp-2 text-sm font-semibold text-white drop-shadow-lg md:text-base">
              {title}
            </h3>
          </div>
        </div>

        <div
          className="overflow-hidden rounded-b-lg transition-all duration-300"
          style={{
            maxHeight: isHovered ? "200px" : "0px",
            opacity: isHovered ? 1 : 0,
          }}
        >
          <div className="border border-t-0 border-gray-200 bg-zinc-900 p-4 shadow-lg">
            <h3
              className="line-clamp-2 text-sm font-semibold text-white transition-all duration-300"
              style={{
                opacity: isHovered ? 1 : 0,
                transform: isHovered ? "translateY(0)" : "translateY(-10px)",
                transitionDelay: "100ms",
              }}
            >
              {title}
            </h3>

            {(durationLabel || lessonsLabel) && (
              <div
                className="mt-3 flex items-center gap-4 text-xs text-white/80 transition-all duration-300"
                style={{
                  opacity: isHovered ? 1 : 0,
                  transform: isHovered ? "translateY(0)" : "translateY(-10px)",
                  transitionDelay: "150ms",
                }}
              >
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

            <div
              className="mt-3 flex items-center justify-between transition-all duration-300"
              style={{
                opacity: isHovered ? 1 : 0,
                transform: isHovered ? "translateY(0)" : "translateY(-10px)",
                transitionDelay: "200ms",
              }}
            >
              <span className="rounded bg-white/10 px-2.5 py-1 text-xs font-medium text-white">
                {category}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white transition-all hover:scale-110 hover:shadow-lg">
                <Play className="h-4 w-4 text-black" fill="currentColor" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ModernCourseCard;
