import { Check, ChevronDown } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useLessonsSequence } from "~/hooks/useLessonsSequence";

import { useCourseAccessProvider } from "../../context/CourseAccessProvider";
import { getChaptersWithAccess } from "../../utils";
import { CHAPTER_PROGRESS_STATUSES } from "../lessonTypes";

import ChapterItem from "./ChapterItem";

type ChapterListProps = {
  completedExpanded: boolean;
  expandedChapters: string[];
  isMobile: boolean;
  onExpandCompleted: () => void;
  onShowAllChapters: () => void;
  onToggleChapter: (id: string) => void;
  showAllChapters: boolean;
};

export default function ChapterList({
  completedExpanded,
  expandedChapters,

  isMobile,
  onExpandCompleted,
  onShowAllChapters,
  onToggleChapter,
  showAllChapters,
}: ChapterListProps) {
  const { t } = useTranslation();
  const { course, isAdminExperience, isPreviewMode } = useCourseAccessProvider();
  const { sequenceEnabled } = useLessonsSequence(course.id);
  const shouldEnforceSequence = sequenceEnabled && !isPreviewMode;
  const chapters = useMemo(
    () => getChaptersWithAccess(course.chapters, shouldEnforceSequence),
    [course.chapters, shouldEnforceSequence],
  );

  const completedChapters = chapters.filter(
    (chapter) => chapter.chapterProgress === CHAPTER_PROGRESS_STATUSES.COMPLETED,
  );
  const activeChapters = chapters.filter(
    (chapter) =>
      isAdminExperience || chapter.chapterProgress !== CHAPTER_PROGRESS_STATUSES.COMPLETED,
  );
  const shouldLimitVisibleChapters = isMobile && !isAdminExperience && !showAllChapters;
  const currentChapterIndex = activeChapters.findIndex(
    (chapter) => chapter.chapterProgress === CHAPTER_PROGRESS_STATUSES.IN_PROGRESS,
  );
  const firstVisibleChapterIndex = currentChapterIndex === -1 ? 0 : currentChapterIndex;
  const visibleActiveChapters = shouldLimitVisibleChapters
    ? activeChapters.slice(firstVisibleChapterIndex, firstVisibleChapterIndex + 2)
    : activeChapters;
  const hiddenChapterCount = activeChapters.length - visibleActiveChapters.length;

  return (
    <div className="relative">
      <div className="absolute bottom-2 left-6 top-2 hidden w-0.5 bg-neutral-200 md:left-5 md:block" />

      <div className="space-y-4">
        {!isAdminExperience && completedChapters.length > 0 && !completedExpanded && (
          <div className="relative">
            <div className="flex gap-4">
              <div className="relative z-10 hidden size-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-success-500 bg-success-500 md:flex md:size-10">
                <Check className="size-6 text-white md:size-5" />
              </div>

              <div className="flex-1 pb-2">
                <button
                  type="button"
                  onClick={onExpandCompleted}
                  className="group w-full cursor-pointer rounded-xl bg-success-50/50 p-5 text-left transition-all hover:bg-success-50 active:bg-success-50 md:p-4"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown className="size-5 flex-shrink-0 text-success-500 md:size-4 " />
                    <h3 className="text-base font-semibold leading-tight text-success-500 md:text-sm">
                      {t("modernCourseView.contents.completedChapters", {
                        count: completedChapters.length,
                      })}
                    </h3>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {!isAdminExperience &&
          completedExpanded &&
          completedChapters.map((chapter) => (
            <ChapterItem
              key={chapter.id}
              chapter={chapter}
              chapterNumber={chapters.indexOf(chapter) + 1}
              courseSlug={course.slug}
              isAdminExperience={isAdminExperience}
              isExpanded={expandedChapters.includes(chapter.id)}
              onToggle={() => onToggleChapter(chapter.id)}
            />
          ))}

        {visibleActiveChapters.map((chapter) => (
          <ChapterItem
            key={chapter.id}
            chapter={chapter}
            chapterNumber={chapters.indexOf(chapter) + 1}
            courseSlug={course.slug}
            isAdminExperience={isAdminExperience}
            isExpanded={expandedChapters.includes(chapter.id)}
            onToggle={() => onToggleChapter(chapter.id)}
          />
        ))}

        {shouldLimitVisibleChapters && hiddenChapterCount > 0 && (
          <div className="relative mt-6">
            <button
              type="button"
              onClick={onShowAllChapters}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-6 py-4 font-semibold text-primary-700 transition-all hover:border-primary-700 hover:bg-neutral-100"
            >
              <ChevronDown className="size-5" />
              {t("modernCourseView.contents.showAllChapters", {
                count: hiddenChapterCount,
              })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
