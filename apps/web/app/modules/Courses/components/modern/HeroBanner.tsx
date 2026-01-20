import { Link } from "@remix-run/react";
import { BookOpen, Clock, Info, Play } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { Button } from "~/components/ui/button";

import { formatDuration } from "./utils";

type HeroBannerProps = {
  id: string;
  title: string;
  category: string;
  thumbnailUrl?: string | null;
  trailerUrl?: string | null;
  estimatedDurationMinutes?: number;
  lessonCount?: number;
};

const HeroBanner = ({
  id,
  title,
  category,
  thumbnailUrl,
  trailerUrl,
  estimatedDurationMinutes,
  lessonCount,
}: HeroBannerProps) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  const durationLabel = formatDuration(estimatedDurationMinutes);
  const lessonsLabel = lessonCount
    ? t("studentCoursesView.modernView.lessonsCount", { count: lessonCount })
    : undefined;

  return (
    <div
      className="relative h-[45vh] min-h-[360px] w-full overflow-hidden md:min-h-[520px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="absolute inset-0">
        <img
          src={thumbnailUrl || DefaultPhotoCourse}
          alt={title}
          className="h-full w-full object-cover"
          onError={(event) => {
            (event.target as HTMLImageElement).src = DefaultPhotoCourse;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-[50%] bg-gradient-to-t from-gray-50 via-gray-50/25 to-transparent" />
      </div>

      {isHovered && trailerUrl && (
        <div className="absolute inset-0 z-10 hidden md:block">
          <video
            src={trailerUrl}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-[50%] bg-gradient-to-t from-gray-50 via-gray-50/25 to-transparent" />
        </div>
      )}

      <div className="relative z-20 flex h-full items-end px-4 pb-12 md:px-8 md:pb-16">
        <div className="max-w-2xl space-y-3 md:space-y-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
            {category}
          </span>

          <h1 className="text-3xl font-bold leading-tight text-white md:text-5xl">{title}</h1>

          {(durationLabel || lessonsLabel) && (
            <div className="flex gap-3 text-xs font-medium text-white/90 md:gap-4 md:text-sm">
              {durationLabel && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{durationLabel}</span>
                </div>
              )}
              {lessonsLabel && (
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  <span>{lessonsLabel}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1 md:gap-3 md:pt-2">
            <Button asChild className="bg-white text-black hover:bg-white/90">
              <Link to={`/course/${id}`}>
                <Play className="mr-2 h-4 w-4" fill="currentColor" />
                {t("studentCoursesView.modernView.hero.start")}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/40 bg-white/20 text-white hover:bg-white/30"
            >
              <Link to={`/course/${id}`}>
                <Info className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">
                  {t("studentCoursesView.modernView.hero.moreInfo")}
                </span>
                <span className="sm:hidden">{t("studentCoursesView.modernView.hero.info")}</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroBanner;
