import { Icon } from "~/components/Icon";
import { cn } from "~/lib/utils";
import { formatNumberToTwoDigits } from "~/utils/formatNumberToTwoDigits";

import { CHAPTER_PROGRESS_STATUSES } from "../lessonTypes";

import type { GetCourseResponse } from "~/api/generated-api";

type ChapterCounterProps = {
  chapterProgress: GetCourseResponse["data"]["chapters"][number]["chapterProgress"];
  displayOrder: GetCourseResponse["data"]["chapters"][number]["displayOrder"];
};

const chapterCounterIcon = {
  completed: "InputRoundedMarkerSuccess",
  in_progress: "InProgress",
  not_started: "NotStartedRounded",
} as const;

export const ChapterCounter = ({
  chapterProgress = CHAPTER_PROGRESS_STATUSES.NOT_STARTED,
  displayOrder,
}: ChapterCounterProps) => {
  const chapterNumber = formatNumberToTwoDigits(displayOrder);

  const isChapterCompleted = chapterProgress === CHAPTER_PROGRESS_STATUSES.COMPLETED;
  const isChapterStarted =
    !isChapterCompleted && chapterProgress === CHAPTER_PROGRESS_STATUSES.IN_PROGRESS;

  return (
    <div
      className={cn(
        "sr-only after:block after:h-full after:w-0.5 md:not-sr-only md:flex md:flex-col md:items-center md:gap-y-1 md:pt-4",
        {
          "after:bg-secondary-200": isChapterStarted,
          "after:bg-primary-200": !isChapterStarted,
          "after:bg-success-200": isChapterCompleted,
        },
      )}
    >
      <div
        className={cn("relative aspect-square size-10 rounded-full", {
          "bg-secondary-50": isChapterStarted,
          "bg-primary-50": !isChapterStarted,
          "bg-success-50": isChapterCompleted,
        })}
      >
        {isChapterStarted || isChapterCompleted ? (
          <Icon
            name={chapterCounterIcon[chapterProgress]}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          />
        ) : (
          <span className="body-base-md absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-accent-foreground">
            {chapterNumber}
          </span>
        )}
      </div>
    </div>
  );
};
