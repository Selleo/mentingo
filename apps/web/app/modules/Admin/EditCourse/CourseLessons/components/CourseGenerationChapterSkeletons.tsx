import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { Skeleton } from "~/components/ui/skeleton";

const SKELETON_CHAPTER_COUNT = 3;

export function CourseGenerationChapterSkeletons() {
  const { t } = useTranslation();

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-3"
      aria-live="polite"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {t("adminCourseView.generation.preparingStructure")}
      </p>

      {Array.from({ length: SKELETON_CHAPTER_COUNT }).map((_, chapterIndex) => (
        <div
          key={`chapter-skeleton-${chapterIndex}`}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-3 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-2/3 rounded-md" />
            <Skeleton className="h-5 w-10 rounded-full" />
          </div>
          <div className="mt-3 space-y-2">
            <Skeleton className="h-3 w-5/6 rounded-md" />
            <Skeleton className="h-3 w-3/4 rounded-md" />
          </div>
        </div>
      ))}
    </motion.section>
  );
}
