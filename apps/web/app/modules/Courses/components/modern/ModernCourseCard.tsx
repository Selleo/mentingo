import { Link } from "@remix-run/react";
import { formatDate } from "date-fns";
import { BookOpen, Clock, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { CardBadge } from "~/components/CardBadge";
import { Icon } from "~/components/Icon";
import { CategoryChip } from "~/components/ui/CategoryChip";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import { stripHtmlTags } from "~/utils/stripHtmlTags";

import { formatDuration } from "./utils";

const VIDEO_PRELOAD_DELAY_MS = 1000;
const CARD_TRANSITION_DURATION = "900ms";
const PANEL_TRANSITION_DURATION = "850ms";
const MEDIA_TRANSITION_DURATION = "650ms";
const CONTENT_TRANSITION_DURATION = "600ms";
const SMOOTH_EASE = "cubic-bezier(0.22,1,0.36,1)";
const ROW_HOVER_COUNT_KEY = "courseRowHoverCount";
const ROW_ELEVATED_Z_INDEX = "1000";

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
  enrolled?: boolean;
  hasFreeChapters?: boolean;
  dueDate?: Date | null;
  popoutEnabled?: boolean;
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
  enrolled,
  hasFreeChapters,
  dueDate,
  popoutEnabled = true,
}: ModernCourseCardProps) => {
  const { t } = useTranslation();
  const { isStudent } = useUserRole();
  const [isHovered, setIsHovered] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const preloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const elevatedRowRef = useRef<HTMLElement | null>(null);

  const setRowElevated = (elevate: boolean) => {
    const row =
      elevatedRowRef.current ?? cardRef.current?.closest<HTMLElement>("[data-course-row]") ?? null;
    if (!row) return;

    if (elevate) {
      const currentCount = Number(row.dataset[ROW_HOVER_COUNT_KEY] || "0");
      const nextCount = currentCount + 1;
      row.dataset[ROW_HOVER_COUNT_KEY] = String(nextCount);
      row.style.position = "relative";
      row.style.zIndex = ROW_ELEVATED_Z_INDEX;
      elevatedRowRef.current = row;
      return;
    }

    const currentCount = Number(row.dataset[ROW_HOVER_COUNT_KEY] || "0");
    const nextCount = Math.max(0, currentCount - 1);
    if (nextCount === 0) {
      delete row.dataset[ROW_HOVER_COUNT_KEY];
      row.style.position = "";
      row.style.zIndex = "";
      elevatedRowRef.current = null;
      return;
    }

    row.dataset[ROW_HOVER_COUNT_KEY] = String(nextCount);
  };

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setRowElevated(isHovered);
    return () => {
      setRowElevated(false);
    };
  }, [isHovered]);

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
  const nonFormattedDescription = useMemo(
    () => (description ? stripHtmlTags(description) : undefined),
    [description],
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
      }, VIDEO_PRELOAD_DELAY_MS);
      return;
    }

    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }
    setShowVideo(false);
    setIsIframeLoaded(false);
  }, [isHovered, trailerUrl]);

  useEffect(() => {
    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, []);

  const image = (
    <>
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
    </>
  );

  return (
    <div
      ref={cardRef}
      data-testid={title}
      className={cn(
        "group relative block w-full max-w-md cursor-pointer overflow-visible",
        className,
      )}
      onMouseEnter={() => {
        timeoutRef.current = setTimeout(() => {
          setIsHovered(true);
        }, 200);
      }}
      onMouseLeave={() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        setIsHovered(false);
        setShowVideo(false);
      }}
    >
      <div className="aspect-video w-full" />

      <Link
        to={`/course/${id}`}
        data-testid="modern-course-card-link"
        className="absolute inset-0 transition-transform"
        style={{
          transform:
            isHovered && popoutEnabled
              ? "scale(1.05) translateY(-32%)"
              : "scale(1) translateY(0px)",
          transformOrigin: "center center",
          zIndex: isHovered ? 120 : 10,
          transitionDuration: CARD_TRANSITION_DURATION,
          transitionTimingFunction: SMOOTH_EASE,
          willChange: "transform",
        }}
        tabIndex={0}
      >
        <div
          className={cn(
            "relative aspect-video overflow-hidden border border-gray-200 bg-white shadow-md transition-all rounded-lg",
            {
              "rounded-b-none": isHovered && popoutEnabled,
            },
          )}
          style={{
            transitionDuration: CARD_TRANSITION_DURATION,
            transitionTimingFunction: SMOOTH_EASE,
          }}
        >
          {isStudent && (
            <div
              className="absolute left-4 right-4 top-4 z-30 flex flex-col gap-y-1 transition-opacity duration-300"
              style={{ opacity: isHovered ? 0 : 1 }}
            >
              {hasFreeChapters && !enrolled && (
                <CardBadge variant="successFilled">
                  <Icon name="FreeRight" className="w-4" />
                  {t("studentCoursesView.other.freeLessons")}
                </CardBadge>
              )}
              {dueDate && (
                <CategoryChip
                  category={t("common.other.dueDate", { date: formatDate(dueDate, "dd.MM.yyyy") })}
                  color="text-warning-600"
                  className="bg-warning-50"
                  textClassName="text-zest-900"
                />
              )}
            </div>
          )}

          {trailerUrl ? (
            <>
              <div
                className={cn(
                  "absolute inset-0 transition-opacity",
                  isHovered && showVideo ? "opacity-0" : "opacity-100",
                )}
                style={{ transitionDuration: MEDIA_TRANSITION_DURATION }}
              >
                {image}
              </div>

              {isEmbed && embedSrc ? (
                <iframe
                  src={isHovered ? embedSrc : undefined}
                  className={cn(
                    "absolute inset-0 h-full w-full border-0 transition-opacity pointer-events-none no-controls",
                    isHovered && showVideo && isIframeLoaded ? "opacity-100" : "opacity-0",
                  )}
                  style={{ transitionDuration: MEDIA_TRANSITION_DURATION }}
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
                    "absolute inset-0 h-full w-full object-cover transition-opacity pointer-events-none",
                    isHovered && showVideo ? "opacity-100" : "opacity-0",
                  )}
                  style={{ transitionDuration: MEDIA_TRANSITION_DURATION }}
                  muted
                  loop
                  playsInline
                  autoPlay
                  controls={false}
                />
              )}
            </>
          ) : (
            <div className="absolute inset-0">{image}</div>
          )}

          {showProgress && (
            <div className="absolute bottom-0 left-0 right-0 z-30 h-1 bg-white/20">
              <div
                className="h-full bg-red-600 transition-all ease-out"
                style={{
                  width: `${progressPercent}%`,
                  transitionDuration: CONTENT_TRANSITION_DURATION,
                }}
              />
            </div>
          )}

          <div
            className="absolute bottom-0 left-0 right-0 z-20 p-4 transition-opacity ease-out"
            style={{ opacity: isHovered ? 0 : 1, transitionDuration: CONTENT_TRANSITION_DURATION }}
          >
            <h3 className="line-clamp-2 text-base font-semibold text-white drop-shadow-lg">
              {title}
            </h3>
          </div>
        </div>

        <div
          className="overflow-hidden rounded-b-lg bg-white shadow-xl transition-all"
          style={{
            maxHeight: isHovered ? "220px" : "0px",
            opacity: isHovered ? 1 : 0,
            transitionDuration: PANEL_TRANSITION_DURATION,
            transitionTimingFunction: SMOOTH_EASE,
            transitionDelay: isHovered ? "0.2s" : "0s",
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

            {nonFormattedDescription && (
              <p className="line-clamp-2 text-xs text-neutral-600">{nonFormattedDescription}</p>
            )}

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
