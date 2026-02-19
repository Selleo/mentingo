import { Link } from "@remix-run/react";
import { formatDate } from "date-fns";
import { BookOpen, Clock, Play } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { CardBadge } from "~/components/CardBadge";
import { Icon } from "~/components/Icon";
import { CategoryChip } from "~/components/ui/CategoryChip";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import { stripHtmlTags } from "~/utils/stripHtmlTags";

import { formatDuration } from "./utils";

const HOVER_ENTER_DELAY_MS = 220;
const HOVER_LEAVE_DELAY_MS = 140;
const VIDEO_PRELOAD_DELAY_MS = 1000;
const PORTAL_CLOSE_DELAY_MS = 520;
const ROW_HOVER_COUNT_KEY = "courseRowHoverCount";
const ROW_ELEVATED_Z_INDEX = "1000";
const INLINE_HOVER_Z_INDEX = 1100;
const PORTAL_Z_INDEX = 2000;
const EXPANDED_DETAILS_HEIGHT_PX = 220;
const VIEWPORT_SAFE_MARGIN_PX = 16;
const BASE_EXPAND_SHIFT_Y_PX = 56;

type PortalRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const isEmbedUrl = (url: string): boolean => {
  return url.includes("iframe.mediadelivery.net/embed") || url.includes("youtube.com/embed");
};

const getEmbedUrlWithParams = (url: string): string => {
  const separator = url.includes("?") ? "&" : "?";
  const params =
    "autoplay=true&muted=true&loop=true&preload=true&controls=0&rel=0&modestbranding=1";
  return `${url}${separator}${params}`;
};

const getCardLinkOpacity = (isPortal: boolean, portalMounted: boolean, isHovered: boolean) => {
  if (isPortal) return portalMounted ? 1 : 0;
  if (!portalMounted) return 1;
  return isHovered ? 0 : 1;
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
  /**
   * Whether to enable the popout effect when hovering over the card.
   * @default true
   */
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
  const [isHovered, setIsHovered] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const [isPopoutExpanded, setIsPopoutExpanded] = useState(false);
  const [isPortalVisible, setIsPortalVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closePortalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const elevatedRowRef = useRef<HTMLElement | null>(null);
  const [portalRect, setPortalRect] = useState<PortalRect | null>(null);

  const { isStudent } = useUserRole();

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
      }, VIDEO_PRELOAD_DELAY_MS);
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

  const updatePortalRect = useCallback(() => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPortalRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, []);

  const closePopoutImmediately = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (closePortalTimeoutRef.current) {
      clearTimeout(closePortalTimeoutRef.current);
    }

    setIsHovered(false);
    setShowVideo(false);
    setIsPortalVisible(false);
    setIsPopoutExpanded(false);
  }, []);

  const setRowElevated = useCallback((elevate: boolean) => {
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
      row.style.zIndex = "";
      row.style.position = "";
      elevatedRowRef.current = null;
      return;
    }

    row.dataset[ROW_HOVER_COUNT_KEY] = String(nextCount);
  }, []);

  useEffect(() => {
    setRowElevated(isHovered || (popoutEnabled && isPortalVisible));
  }, [isHovered, isPortalVisible, popoutEnabled, setRowElevated]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (closePortalTimeoutRef.current) {
        clearTimeout(closePortalTimeoutRef.current);
      }
      setRowElevated(false);
    };
  }, [setRowElevated]);

  useEffect(() => {
    if (!popoutEnabled) {
      setIsPortalVisible(false);
      return;
    }

    if (isHovered) {
      if (closePortalTimeoutRef.current) {
        clearTimeout(closePortalTimeoutRef.current);
      }
      setIsPortalVisible(true);
      return;
    }

    if (!isPortalVisible) return;

    closePortalTimeoutRef.current = setTimeout(() => {
      setIsPortalVisible(false);
    }, PORTAL_CLOSE_DELAY_MS);

    return () => {
      if (closePortalTimeoutRef.current) {
        clearTimeout(closePortalTimeoutRef.current);
      }
    };
  }, [isHovered, isPortalVisible, popoutEnabled]);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || !cardRef.current || !popoutEnabled || !isHovered) return;

    updatePortalRect();

    const resizeObserver = new ResizeObserver(() => updatePortalRect());
    resizeObserver.observe(cardRef.current);

    window.addEventListener("scroll", updatePortalRect, { passive: true });
    window.addEventListener("scroll", closePopoutImmediately, { passive: true });
    window.addEventListener("wheel", closePopoutImmediately, { passive: true });
    window.addEventListener("touchmove", closePopoutImmediately, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", updatePortalRect);
      window.removeEventListener("scroll", closePopoutImmediately);
      window.removeEventListener("wheel", closePopoutImmediately);
      window.removeEventListener("touchmove", closePopoutImmediately);
    };
  }, [closePopoutImmediately, isHovered, popoutEnabled, updatePortalRect]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (closePortalTimeoutRef.current) clearTimeout(closePortalTimeoutRef.current);
    if (popoutEnabled) updatePortalRect();
    if (isHovered) return;
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(true), HOVER_ENTER_DELAY_MS);
    setShowVideo(false);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setShowVideo(false);
    }, HOVER_LEAVE_DELAY_MS);
  };

  const nonFormattedDescription = useMemo(
    () => (description ? stripHtmlTags(description) : undefined),
    [description],
  );

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

  const courseBadges = isStudent && (
    <div
      className="absolute left-4 right-4 top-4 flex flex-col gap-y-1 transition-opacity duration-300"
      style={{ opacity: isHovered ? 0 : 1, zIndex: isHovered ? 10 : 50 }}
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
  );

  const portalMounted = popoutEnabled && Boolean(portalRect) && (isHovered || isPortalVisible);
  const portalActive = portalMounted && isHovered;

  useEffect(() => {
    if (!portalActive) {
      setIsPopoutExpanded(false);
      return;
    }

    const frameId = window.requestAnimationFrame(() => setIsPopoutExpanded(true));

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [portalActive]);

  const cardContent = ({
    withRef = false,
    isPortal = false,
  }: {
    withRef?: boolean;
    isPortal?: boolean;
  }) => {
    const shouldExpand = isPortal
      ? isHovered && isPopoutExpanded
      : popoutEnabled
        ? false
        : isHovered;

    let linkTransform = "scale(1)";

    if (shouldExpand) {
      if (isPortal && portalRect && typeof window !== "undefined") {
        const overflowBottom =
          portalRect.top +
          portalRect.height +
          EXPANDED_DETAILS_HEIGHT_PX +
          VIEWPORT_SAFE_MARGIN_PX -
          window.innerHeight;

        const extraShiftUpPx = overflowBottom > 0 ? portalRect.height : 0;
        const totalShiftUpPx = BASE_EXPAND_SHIFT_Y_PX + extraShiftUpPx;

        linkTransform = `scale(1.05) translateY(-${totalShiftUpPx / 1.75}px)`;
      } else {
        linkTransform = `scale(1.05) translateY(-${BASE_EXPAND_SHIFT_Y_PX}px)`;
      }
    }

    const linkOpacity = getCardLinkOpacity(isPortal, portalMounted, isHovered);
    const wrapperOpacity = linkOpacity;
    return (
      <div
        className={cn("relative z-50", className)}
        ref={withRef ? cardRef : undefined}
        style={{
          opacity: wrapperOpacity,
          transition: "opacity 120ms ease-out",
        }}
      >
        <div
          className={cn(
            "group relative block w-full max-w-md cursor-pointer overflow-visible",
            className,
            popoutEnabled && shouldExpand ? "absolute" : "",
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            {image}
            {courseBadges}
          </div>

          <div className="aspect-video w-full" />

          <Link
            to={`/course/${id}`}
            className="absolute inset-0 transition-transform duration-500 ease-out"
            style={{
              transform: linkTransform,
              transformOrigin: "center center",
              zIndex: isHovered ? INLINE_HOVER_Z_INDEX : 10,
              opacity: linkOpacity,
              willChange: "transform",
            }}
            tabIndex={0}
          >
            <div
              className={cn(
                "relative aspect-video overflow-hidden border border-gray-200 bg-white shadow-md transition-all duration-300 rounded-lg",
                {
                  "rounded-b-none": shouldExpand,
                },
              )}
            >
              {trailerUrl ? (
                <>
                  <div
                    className={cn(
                      "absolute inset-0 transition-opacity duration-300",
                      isHovered && showVideo ? "opacity-0" : "opacity-100",
                    )}
                  >
                    {image}
                  </div>
                  {isEmbed && embedSrc ? (
                    <iframe
                      src={isHovered ? embedSrc : undefined}
                      className={cn(
                        "absolute inset-0 h-full w-full border-0 transition-opacity duration-300 pointer-events-none no-controls",
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
                        "absolute inset-0 h-full w-full object-cover transition-opacity duration-300 pointer-events-none",
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
                <div className="absolute inset-0">{image}</div>
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
                style={{ opacity: shouldExpand ? 0 : 1 }}
              >
                <h3 className="line-clamp-2 text-base font-semibold text-white drop-shadow-lg">
                  {title}
                </h3>
              </div>
            </div>

            <div
              className="overflow-hidden rounded-b-lg bg-white shadow-xl transition-all duration-300"
              style={{
                maxHeight: shouldExpand ? "220px" : "0px",
                opacity: shouldExpand ? 1 : 0,
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
      </div>
    );
  };

  return (
    <>
      {cardContent({ withRef: true })}
      {portalMounted && portalRect && typeof document !== "undefined"
        ? createPortal(
            <div
              style={{
                position: "fixed",
                top: portalRect.top,
                left: portalRect.left,
                width: portalRect.width,
                height: portalRect.height,
                pointerEvents: "auto",
                zIndex: PORTAL_Z_INDEX,
              }}
            >
              {cardContent({ isPortal: true })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

export default ModernCourseCard;
