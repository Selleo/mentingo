import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { formatDuration } from "~/modules/Courses/utils/formatDuration";

type ProgressStatCardProps = {
  completedChapterCount: number;
  courseChapterCount: number;
  isDraftCourse: boolean;
  isAdminExperience: boolean;
  onEnterLearningMode: () => void;
  timeLeftSeconds: number;
};

export default function ProgressStatCard({
  completedChapterCount,
  courseChapterCount,
  isDraftCourse,
  isAdminExperience,
  onEnterLearningMode,
  timeLeftSeconds,
}: ProgressStatCardProps) {
  const { t } = useTranslation();
  const progressPercentage =
    courseChapterCount > 0 ? Math.round((completedChapterCount / courseChapterCount) * 100) : 0;
  const isCourseFinished =
    !isAdminExperience && courseChapterCount > 0 && completedChapterCount >= courseChapterCount;
  const timeLeftLabel = isAdminExperience ? 0 : formatDuration(timeLeftSeconds, t);

  return (
    <div className="group relative flex h-full items-center overflow-hidden rounded-2xl bg-white p-4 pl-6 shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-success-500" aria-hidden="true" />
      <div
        className={cn("flex w-full items-center gap-4 transition-all duration-200", {
          "opacity-45 group-hover:blur-[2px]": isAdminExperience,
        })}
      >
        <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-xl bg-success-50">
          <Clock className="size-6 text-success-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-xs uppercase tracking-wider text-neutral-800">
            {t("modernCourseView.stats.yourProgress")}
          </p>

          <div className="mb-1.5">
            {isCourseFinished ? (
              <span className="whitespace-nowrap text-xl font-bold text-neutral-950">
                {t("modernCourseView.stats.courseFinished")}
              </span>
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="whitespace-nowrap text-xl font-bold text-neutral-950">
                  {timeLeftLabel}
                </span>
                <span className="whitespace-nowrap text-sm text-neutral-800">
                  {t("modernCourseView.stats.remaining")}
                </span>
              </div>
            )}
          </div>

          {!isAdminExperience && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-800">
                  {t("modernCourseView.stats.chapterProgress", {
                    completed: completedChapterCount,
                    count: courseChapterCount,
                    total: courseChapterCount,
                  })}
                </span>
                <span className="text-xs font-semibold text-success-500">
                  {progressPercentage}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-primary-100">
                <div
                  className="h-1.5 rounded-full bg-success-500 transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      {isAdminExperience && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-neutral-950/35 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
          <p className="mx-3 rounded-xl  bg-white/95 px-4 py-3 text-center text-sm font-semibold text-neutral-950 ">
            {isDraftCourse ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        type="button"
                        disabled
                        variant="link"
                        className="h-auto p-0 text-primary-700 underline"
                      >
                        {t("modernCourseView.learningMode.enter")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent variant="black">
                    {t("modernCourseView.draftCourseTooltip")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                type="button"
                onClick={onEnterLearningMode}
                variant="link"
                className="h-auto p-0 text-primary-700 underline transition-colors hover:text-primary-800"
              >
                {t("modernCourseView.learningMode.enter")}
              </Button>
            )}
            {t("modernCourseView.stats.trackProgress")}
          </p>
        </div>
      )}
    </div>
  );
}
