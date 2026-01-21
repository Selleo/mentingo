import { Link } from "@remix-run/react";
import { BookOpen, Clock, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { cn } from "~/lib/utils";

import { formatDuration } from "./utils";

type TopCourseCardProps = {
  id: string;
  rank: number;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  trailerUrl?: string | null;
  estimatedDurationMinutes?: number;
  lessonCount?: number;
};

const TopCourseCard = ({
  id,
  rank,
  title,
  description,
  thumbnailUrl,
  trailerUrl,
  estimatedDurationMinutes,
  lessonCount,
}: TopCourseCardProps) => {
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
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
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
      className="group relative block w-full max-w-sm cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="pointer-events-none absolute left-[-52px] top-0 h-52 w-28">
        <svg className="h-full w-full" viewBox="0 0 160 190" fill="none">
          <text
            x="50%"
            y="50%"
            dominantBaseline="middle"
            textAnchor="middle"
            className="fill-zinc-200 stroke-zinc-300"
            style={{
              fontSize: "230px",
              fontWeight: "900",
              strokeWidth: "2px",
            }}
          >
            {rank}
          </text>
        </svg>
      </div>

      <Link to={`/course/${id}`} className="block relative">
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

    // <Link
    //   to={`/course/${id}`}
    //   className="group relative block w-full max-w-sm cursor-pointer overflow-visible"
    //   onMouseEnter={handleMouseEnter}
    //   onMouseLeave={handleMouseLeave}
    // >
    //   <div className="pointer-events-none absolute -left-10 top-5 z-[1300] flex-shrink-0">
    //     <svg className="h-48 w-40 pt-5 pl-10" viewBox="0 0 160 190" fill="none">
    //       <text
    //         x="50%"
    //         y="50%"
    //         dominantBaseline="middle"
    //         textAnchor="middle"
    //         className="fill-zinc-200 stroke-zinc-300"
    //         style={{
    //           fontSize: "190px",
    //           fontWeight: "900",
    //           strokeWidth: "2px",
    //         }}
    //       >
    //         {rank}
    //       </text>
    //     </svg>
    //   </div>

    //   <div className="relative">
    //     <div className="relative aspect-video overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md transition-transform duration-300 group-hover:-translate-y-1">
    //       {trailerUrl ? (
    //         <>
    //           <img
    //             src={thumbnailUrl || DefaultPhotoCourse}
    //             alt={title}
    //             className={cn(
    //               "h-full w-full object-cover transition-opacity duration-300",
    //               isHovered ? "opacity-0" : "opacity-100",
    //             )}
    //             onError={(event) => {
    //               (event.target as HTMLImageElement).src = DefaultPhotoCourse;
    //             }}
    //           />
    //           <video
    //             ref={videoRef}
    //             src={trailerUrl}
    //             className={cn(
    //               "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
    //               isHovered ? "opacity-100" : "opacity-0",
    //             )}
    //             muted
    //             loop
    //             playsInline
    //           />
    //         </>
    //       ) : (
    //         <img
    //           src={thumbnailUrl || DefaultPhotoCourse}
    //           alt={title}
    //           className="h-full w-full object-cover"
    //           onError={(event) => {
    //             (event.target as HTMLImageElement).src = DefaultPhotoCourse;
    //           }}
    //         />
    //       )}
    //       <div className="absolute inset-0 bg-gradient-to-t from-black/100 via-black/60 to-transparent" />
    //       <div className="absolute bottom-0 left-0 right-0 p-4">
    //         <h3 className="line-clamp-2 text-base font-semibold text-white drop-shadow-lg">
    //           {title}
    //         </h3>
    //       </div>
    //     </div>

    //     <div
    //       className={cn(
    //         "absolute left-1/2 top-0 z-[1400] w-[min(88vw,400px)] -translate-x-1/2 rounded-xl border border-gray-200 bg-white shadow-2xl transition-all duration-200 ease-out",
    //         isHovered
    //           ? "-translate-y-5 scale-[1.04] opacity-100 pointer-events-auto"
    //           : "-translate-y-2 scale-100 opacity-0 pointer-events-none",
    //       )}
    //     >
    //       <div className="relative aspect-video overflow-hidden rounded-t-xl">
    //         {trailerUrl ? (
    //           <>
    //             <img
    //               src={thumbnailUrl || DefaultPhotoCourse}
    //               alt={title}
    //               className={cn(
    //                 "h-full w-full object-cover transition-opacity duration-300",
    //                 isHovered ? "opacity-0" : "opacity-100",
    //               )}
    //               onError={(event) => {
    //                 (event.target as HTMLImageElement).src = DefaultPhotoCourse;
    //               }}
    //             />
    //             <video
    //               ref={videoRef}
    //               src={trailerUrl}
    //               className={cn(
    //                 "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
    //                 isHovered ? "opacity-100" : "opacity-0",
    //               )}
    //               muted
    //               loop
    //               playsInline
    //             />
    //           </>
    //         ) : (
    //           <img
    //             src={thumbnailUrl || DefaultPhotoCourse}
    //             alt={title}
    //             className="h-full w-full object-cover"
    //             onError={(event) => {
    //               (event.target as HTMLImageElement).src = DefaultPhotoCourse;
    //             }}
    //           />
    //         )}
    //         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
    //         <div className="absolute bottom-0 left-0 right-0 p-4">
    //           <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-white drop-shadow-lg">
    //             {title}
    //           </h3>
    //         </div>
    //       </div>

    //       <div className="space-y-3 rounded-b-xl bg-white p-4">
    //         {(durationLabel || lessonsLabel) && (
    //           <div className="flex items-center gap-4 text-xs text-neutral-700">
    //             {durationLabel && (
    //               <div className="flex items-center gap-1.5">
    //                 <Clock className="h-3.5 w-3.5" />
    //                 <span>{durationLabel}</span>
    //               </div>
    //             )}
    //             {lessonsLabel && (
    //               <div className="flex items-center gap-1.5">
    //                 <BookOpen className="h-3.5 w-3.5" />
    //                 <span>{lessonsLabel}</span>
    //               </div>
    //             )}
    //           </div>
    //         )}

    //         {description && <p className="line-clamp-3 text-sm text-neutral-700">{description}</p>}

    //         <div className="flex items-center justify-between">
    //           <span className="rounded bg-neutral-900/10 px-2.5 py-1 text-xs font-medium text-neutral-900">
    //             {category}
    //           </span>
    //           <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white shadow-md">
    //             <Play className="h-4 w-4" fill="currentColor" />
    //           </div>
    //         </div>
    //       </div>
    //     </div>
    //   </div>
    // </Link>
  );
};

export default TopCourseCard;
