import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import ChapterItem from "./ChapterItem";

import type { GetCourseResponse } from "~/api/generated-api";

type ChapterListProps = {
  completedExpanded: boolean;
  course: GetCourseResponse["data"];
  expandedChapters: string[];
  isAdminExperience: boolean;
  isMobile: boolean;
  onExpandCompleted: () => void;
  onShowAllChapters: () => void;
  onToggleChapter: (id: string) => void;
  showAllChapters: boolean;
};

export default function ChapterList({
  completedExpanded,
  course,
  expandedChapters,
  isAdminExperience,
  isMobile,
  onExpandCompleted,
  onShowAllChapters,
  onToggleChapter,
  showAllChapters,
}: ChapterListProps) {
  const { t } = useTranslation();
  const completedChapters = course.chapters.filter(
    (chapter) => chapter.chapterProgress === "completed",
  );
  const activeChapters = course.chapters
    .filter((chapter) => isAdminExperience || chapter.chapterProgress !== "completed")
    .filter((chapter, _idx, chapters) => {
      if (isMobile && !isAdminExperience && !showAllChapters) {
        const currentIndex = chapters.findIndex((item) => item.chapterProgress === "in_progress");
        const chapterIndex = chapters.indexOf(chapter);
        return chapterIndex >= currentIndex && chapterIndex <= currentIndex + 1;
      }

      return true;
    });

  return (
    <div className="relative">
      <div className="absolute bottom-2 left-[24px] top-2 hidden w-0.5 bg-[#e5e5e5] md:left-[20px] md:block" />

      <div className="space-y-4">
        {!isAdminExperience && completedChapters.length > 0 && !completedExpanded && (
          <div className="relative">
            <div className="flex gap-4">
              <div className="relative z-10 hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#26b183] bg-[#26b183] md:flex md:h-10 md:w-10">
                <Check className="h-6 w-6 text-white md:h-5 md:w-5" />
              </div>

              <div className="flex-1 pb-2">
                <button
                  type="button"
                  onClick={onExpandCompleted}
                  className="group w-full cursor-pointer rounded-xl bg-green-50/50 p-5 text-left transition-all hover:bg-green-50 active:bg-green-50 md:p-4"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown className="h-5 w-5 flex-shrink-0 text-[#26b183] md:h-4 md:w-4" />
                    <h3 className="text-base font-semibold leading-tight text-[#26b183] md:text-sm">
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
              chapterNumber={course.chapters.indexOf(chapter) + 1}
              isAdminExperience={isAdminExperience}
              isExpanded={expandedChapters.includes(chapter.id)}
              onToggle={() => onToggleChapter(chapter.id)}
            />
          ))}

        {activeChapters.map((chapter) => (
          <ChapterItem
            key={chapter.id}
            chapter={chapter}
            chapterNumber={course.chapters.indexOf(chapter) + 1}
            isAdminExperience={isAdminExperience}
            isExpanded={expandedChapters.includes(chapter.id)}
            onToggle={() => onToggleChapter(chapter.id)}
          />
        ))}

        {isMobile &&
          !isAdminExperience &&
          !showAllChapters &&
          course.chapters.filter((chapter) => chapter.chapterProgress !== "completed").length >
            2 && (
            <div className="relative mt-6">
              <button
                type="button"
                onClick={onShowAllChapters}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-4 font-semibold text-[#3f58b6] transition-all hover:border-[#3f58b6] hover:bg-gray-100"
              >
                <ChevronDown className="h-5 w-5" />
                {t("modernCourseView.contents.showAllChapters", {
                  count:
                    course.chapters.filter((chapter) => chapter.chapterProgress !== "completed")
                      .length - 2,
                })}
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
