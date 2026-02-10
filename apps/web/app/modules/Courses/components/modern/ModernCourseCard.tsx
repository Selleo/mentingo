import { Link } from "@remix-run/react";
import { formatDate } from "date-fns";
import { BookOpen, Clock, Play } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { CardBadge } from "~/components/CardBadge";
import { Icon } from "~/components/Icon";
import { CategoryChip } from "~/components/ui/CategoryChip";
import { cn } from "~/lib/utils";
import { stripHtmlTags } from "~/utils/stripHtmlTags";

import { formatDuration } from "./utils";

const isEmbedUrl = (url: string): boolean => {
  return url.includes("iframe.mediadelivery.net/embed") || url.includes("youtube.com/embed");
};

// Bunny CDN "Advanced Token Authentication" (SHA256):
// token = Base64UrlSafe( SHA256( securityKey + signedPath + expires ) )
const arrayBufferToBase64Url = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  // base64 -> base64url (replace +/ and strip =)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const sha256Base64Url = async (value: string): Promise<string> => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return arrayBufferToBase64Url(digest);
};

const parseBunnyEmbedUrl = (url: string): { libraryId: string; videoId: string } | null => {
  const match = url.match(/iframe\.mediadelivery\.net\/embed\/([^/]+)\/([^/?#]+)/);
  if (!match) return null;
  const [, libraryId, videoId] = match;
  return { libraryId, videoId };
};

const getBunnySignedOriginalUrl = async ({
  trailerUrl,
  cdnHost,
  signingKey,
  ttlSeconds = 3600,
}: {
  trailerUrl: string;
  cdnHost: string;
  signingKey: string;
  ttlSeconds?: number;
}): Promise<string | null> => {
  const parsed = parseBunnyEmbedUrl(trailerUrl);
  if (!parsed) return null;

  const { videoId } = parsed;
  const signedPath = `/${videoId}/original`;
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;

  const token = await sha256Base64Url(`${signingKey}${signedPath}${expires}`);
  console.log({ token });
  return `https://${cdnHost}${signedPath}?token=${token}&expires=${expires}`;
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
  const [signedBunnyOriginalSrc, setSignedBunnyOriginalSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [portalRect, setPortalRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

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

  const bunnyCdnHost = import.meta.env.VITE_BUNNY_STREAM_CDN_URL;
  const bunnySigningKey = import.meta.env.VITE_BUNNY_STREAM_SIGNING_KEY;
  const isBunnyEmbed = Boolean(trailerUrl?.includes("iframe.mediadelivery.net/embed"));

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    getBunnySignedOriginalUrl({
      trailerUrl: trailerUrl ?? "",
      cdnHost: bunnyCdnHost,
      signingKey: bunnySigningKey,
      ttlSeconds: 60 * 60,
    })
      .then((url) => {
        console.log({ url });
        if (!cancelled) setSignedBunnyOriginalSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSignedBunnyOriginalSrc(null);
      });

    return () => {
      cancelled = true;
    };
  }, [bunnyCdnHost, bunnySigningKey, isBunnyEmbed, trailerUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!trailerUrl || !isBunnyEmbed || !bunnyCdnHost || !bunnySigningKey) return;

    // Refresh the token periodically so it doesn't expire mid-session.
    // Fast-return when not needed.
    const intervalId = window.setInterval(
      () => {
        getBunnySignedOriginalUrl({
          trailerUrl,
          cdnHost: bunnyCdnHost,
          signingKey: bunnySigningKey,
          ttlSeconds: 60 * 60,
        })
          .then((url) => {
            if (url) setSignedBunnyOriginalSrc(url);
          })
          .catch(() => {
            // ignore refresh failures
          });
      },
      15 * 60 * 1000,
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [bunnyCdnHost, bunnySigningKey, isBunnyEmbed, trailerUrl]);

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

  useLayoutEffect(() => {
    if (typeof window === "undefined" || !cardRef.current) return;

    const updateRect = () => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      setPortalRect({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      });
    };

    updateRect();

    const resizeObserver = new ResizeObserver(() => updateRect());
    resizeObserver.observe(cardRef.current);

    window.addEventListener("scroll", updateRect, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", updateRect);
    };
  }, []);

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

  const courseBadges = (
    <div
      className="absolute left-4 right-4 top-4 flex flex-col gap-y-1 transition-opacity duration-300"
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
  );

  const portalActive = popoutEnabled && isHovered && Boolean(portalRect);

  const cardContent = ({
    withRef = false,
    isPortal = false,
  }: {
    withRef?: boolean;
    isPortal?: boolean;
  }) => {
    const linkTransform = isHovered ? "scale(1.05) translateY(-35%)" : "scale(1)";
    const linkOpacity = isPortal ? (portalActive ? 1 : 0) : portalActive ? 0 : 1;
    const wrapperOpacity = linkOpacity;

    console.log({ signedBunnyOriginalSrc });

    return (
      <div
        className={cn("relative z-50", className)}
        ref={withRef ? cardRef : undefined}
        style={{ opacity: wrapperOpacity, transition: "opacity 150ms ease-out" }}
      >
        <div
          className={cn(
            "group relative block w-full max-w-md cursor-pointer overflow-visible",
            className,
            popoutEnabled && isHovered ? "absolute" : "",
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
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
                {courseBadges}
              </div>
              {isEmbed && embedSrc ? (
                <iframe
                  src={isHovered ? embedSrc : undefined}
                  className={cn(
                    "absolute inset-0 h-full w-full border-0 transition-opacity duration-300 pointer-events-none",
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
            <div className="absolute inset-0">
              {image}
              {courseBadges}
            </div>
          )}

          <Link
            to={`/course/${id}`}
            className="absolute inset-0 transition-transform duration-200 ease-out"
            style={{
              transform: linkTransform,
              transformOrigin: "center center",
              zIndex: isHovered ? 50 : 1,
              opacity: linkOpacity,
              willChange: "transform",
            }}
            tabIndex={0}
          >
            <div
              className={cn(
                "relative aspect-video overflow-hidden border border-gray-200 bg-white shadow-md transition-all duration-300 rounded-lg",
                {
                  "rounded-b-none": isHovered,
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
                  {signedBunnyOriginalSrc ? (
                    <video
                      ref={videoRef}
                      src={signedBunnyOriginalSrc}
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
                  ) : isEmbed && embedSrc ? (
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
      {popoutEnabled && portalRect && typeof document !== "undefined"
        ? createPortal(
            <div
              style={{
                position: "absolute",
                top: portalRect.top,
                left: portalRect.left,
                width: portalRect.width,
                height: portalRect.height,
                pointerEvents: "none",
                zIndex: 9999,
              }}
            >
              <div style={{ pointerEvents: "none" }}>{cardContent({ isPortal: true })}</div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

export default ModernCourseCard;
