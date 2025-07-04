import { Link } from "@remix-run/react";
import { cva } from "class-variance-authority";
import { t } from "i18next";
import { startCase } from "lodash-es";
import { useTranslation } from "react-i18next";

import CardPlaceholder from "~/assets/placeholders/card-placeholder.jpg";
import { CardBadge } from "~/components/CardBadge";
import CourseProgress from "~/components/CourseProgress";
import { Icon } from "~/components/Icon";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";

import type { GetUserStatisticsResponse } from "~/api/generated-api";

const buttonVariants = cva("w-full transition", {
  defaultVariants: {
    variant: "not_started",
  },
  variants: {
    variant: {
      not_started: "border-primary-200 hover:border-primary-500",
      in_progress: "border-secondary-200 hover:border-secondary-500",
      completed: "border-success-500",
    },
  },
});

const getButtonProps = (
  chapterProgress: NonNullable<GetUserStatisticsResponse["data"]["nextLesson"]>["chapterProgress"],
) => {
  if (chapterProgress === "in_progress") {
    return { text: t("clientStatisticsView.button.continue"), colorClass: "text-secondary-500" };
  }

  return { text: t("clientStatisticsView.button.start"), colorClass: "text-primary-700" };
};

const cardBadgeIcon = {
  completed: "InputRoundedMarkerSuccess",
  in_progress: "InProgress",
  not_started: "NotStartedRounded",
} as const;

const cardBadgeVariant: Record<string, "successOutlined" | "secondary" | "default"> = {
  completed: "successOutlined",
  in_progress: "secondary",
  not_started: "default",
};

export const ChapterCard = (
  chapterDetails: NonNullable<GetUserStatisticsResponse["data"]["nextLesson"]>,
) => {
  const cardClasses = buttonVariants({
    variant: chapterDetails.chapterProgress,
  });

  const { text: buttonText, colorClass: buttonColorClass } = getButtonProps(
    chapterDetails.chapterProgress,
  );
  const { t } = useTranslation();

  const hrefToLessonPage = `course/${chapterDetails.courseId}/lesson/${chapterDetails.lessonId}`;

  return (
    <Card className={cardClasses}>
      <CardContent className="h-full p-4">
        <Link className="flex h-full flex-col gap-4" to={hrefToLessonPage}>
          <div className="relative">
            <img
              src={chapterDetails.courseThumbnail ?? CardPlaceholder}
              alt={`Lesson ${chapterDetails.chapterDisplayOrder}`}
              loading="eager"
              decoding="async"
              className="aspect-video w-full rounded-lg object-cover object-center drop-shadow-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).src = CardPlaceholder;
              }}
            />
            {chapterDetails.chapterProgress && (
              <CardBadge
                variant={cardBadgeVariant[chapterDetails.chapterProgress]}
                className="absolute left-3 top-3"
              >
                <Icon name={cardBadgeIcon[chapterDetails.chapterProgress]} />
                {startCase(chapterDetails.chapterProgress)}
              </CardBadge>
            )}
            <span className="absolute bottom-0 right-0 flex size-8 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full bg-white text-primary-700">
              {chapterDetails.chapterDisplayOrder.toString().padStart(2, "0")}
            </span>
          </div>
          <div className="flex flex-grow flex-col">
            <div className="flex items-center justify-between">
              <div className="flex h-full w-full flex-col bg-white">
                <CourseProgress
                  label={t("studentChapterCardView.other.chapterProgress")}
                  isCompleted={chapterDetails.chapterProgress === "completed"}
                  completedLessonCount={chapterDetails.completedLessonCount}
                  courseLessonCount={chapterDetails.lessonCount}
                />
              </div>
            </div>
            <div className="flex flex-col gap-y-2 pb-8">
              <h4 className="mt-2 text-sm font-medium text-neutral-950">
                {chapterDetails.chapterTitle}
              </h4>
            </div>
            <button
              className={cn(
                "inline-flex items-center self-start text-xs font-medium",
                buttonColorClass,
              )}
            >
              {buttonText} <Icon name="CarretRight" className="ml-1 size-4" />
            </button>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
};
