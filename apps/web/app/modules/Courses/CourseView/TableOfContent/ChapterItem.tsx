import { BookOpen, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";
import { formatDuration } from "~/modules/Courses/utils/formatDuration";

import LessonItem from "./LessonItem";

import type { GetCourseResponse } from "~/api/generated-api";

type Chapter = GetCourseResponse["data"]["chapters"][number];

type ChapterItemProps = {
  chapter: Chapter;
  chapterNumber: number;
  isAdminExperience: boolean;
  isExpanded: boolean;
  onToggle: () => void;
};

const getChapterStyle = ({
  isCompleted,
  isCurrent,
}: {
  isCompleted: boolean;
  isCurrent: boolean;
}) => {
  if (isCompleted) {
    return {
      bg: "bg-success-50/50 hover:bg-success-50",
      icon: "text-success-500",
      title: "text-success-500",
    };
  }

  if (isCurrent) {
    return {
      bg: "bg-primary-50/50 hover:bg-primary-50",
      icon: "text-primary-700",
      title: "text-primary-700",
    };
  }

  return {
    bg: "bg-neutral-50/50 hover:bg-neutral-50",
    icon: "text-neutral-800",
    title: "text-neutral-800",
  };
};

const getChapterCircleStyle = ({
  isCompleted,
  isCurrent,
}: {
  isCompleted: boolean;
  isCurrent: boolean;
}) => {
  if (isCompleted) {
    return "border-success-500 bg-success-500";
  }

  if (isCurrent) {
    return "border-primary-700 bg-primary-700";
  }

  return "border-neutral-200 bg-white";
};

const getActiveLessonProgressCount = (chapter: Chapter) =>
  chapter.lessons.filter(
    (lesson) => lesson.status === "completed" || lesson.status === "in_progress",
  ).length;

export default function ChapterItem({
  chapter,
  chapterNumber,
  isAdminExperience,
  isExpanded,
  onToggle,
}: ChapterItemProps) {
  const { t } = useTranslation();
  const isCompleted = !isAdminExperience && chapter.chapterProgress === "completed";
  const isCurrent = !isAdminExperience && chapter.chapterProgress === "in_progress";
  const chapterStyle = getChapterStyle({ isCompleted, isCurrent });
  const activeLessonProgressCount = getActiveLessonProgressCount(chapter);
  const lessonCount = chapter.lessons.length || chapter.lessonCount;
  const progressLessonCount = isCompleted ? lessonCount : activeLessonProgressCount;
  const shouldShowActiveProgress =
    !isAdminExperience && lessonCount > 0 && (isCurrent || isExpanded);

  return (
    <div className="relative">
      <div className="flex gap-4">
        <div
          className={cn(
            "relative z-10 hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 md:flex md:h-10 md:w-10",
            getChapterCircleStyle({ isCompleted, isCurrent }),
          )}
        >
          {isCompleted ? (
            <Check className="h-6 w-6 text-white md:h-5 md:w-5" />
          ) : isCurrent ? (
            <span className="text-base font-bold text-white md:text-sm">{chapterNumber}</span>
          ) : (
            <span
              className={cn(
                "text-base font-bold md:text-sm",
                isAdminExperience ? "text-neutral-800" : "text-neutral-400",
              )}
            >
              {chapterNumber}
            </span>
          )}
        </div>

        <div className="flex-1 pb-2">
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "group w-full cursor-pointer rounded-xl p-5 text-left transition-all md:p-4",
              chapterStyle.bg,
            )}
          >
            <div className="mb-2 flex items-center gap-3">
              {isExpanded ? (
                <ChevronUp
                  className={cn("h-5 w-5 flex-shrink-0 md:h-4 md:w-4", chapterStyle.icon)}
                />
              ) : (
                <ChevronDown
                  className={cn("h-5 w-5 flex-shrink-0 md:h-4 md:w-4", chapterStyle.icon)}
                />
              )}
              <h3
                className={cn(
                  "flex-1 text-base font-semibold leading-tight md:text-sm",
                  chapterStyle.title,
                )}
              >
                {chapter.title}
              </h3>
              <span className="flex-shrink-0 whitespace-nowrap text-sm text-neutral-800 md:text-xs">
                {formatDuration(chapter.estimatedDurationSeconds)}
              </span>
            </div>

            <div className="ml-7 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-neutral-800">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {t("modernCourseView.contents.lessons", {
                    count: chapter.lessonCount,
                  })}
                </span>
              </div>

              {shouldShowActiveProgress && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs font-semibold text-primary-700">
                    <span>
                      {progressLessonCount}/{lessonCount}
                    </span>
                  </div>
                  <div className="flex w-32 gap-0.5">
                    {Array.from({ length: lessonCount }).map((_, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "h-2 flex-1 rounded-full transition-all",
                          idx < progressLessonCount ? "bg-primary-700" : "bg-primary-100",
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </button>

          {isExpanded && chapter.lessons && (
            <div className="ml-7 mt-3">
              {chapter.lessons.map((lesson, lessonIndex) => (
                <LessonItem
                  key={lesson.id}
                  isAdminExperience={isAdminExperience}
                  isCompleted={isCompleted}
                  isCurrent={isCurrent}
                  isLast={lessonIndex === chapter.lessons.length - 1}
                  lesson={lesson}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
