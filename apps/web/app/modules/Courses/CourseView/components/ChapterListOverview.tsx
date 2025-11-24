import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useLessonsSequence } from "~/hooks/useLessonsSequence";

import { getChaptersWithAccess } from "../../utils";
import { CourseChapter } from "../CourseChapter";

import type { GetCourseResponse } from "~/api/generated-api";

interface ChapterListOverviewProps {
  course?: GetCourseResponse["data"];
}

export function ChapterListOverview({ course }: ChapterListOverviewProps) {
  const { t } = useTranslation();

  const { sequenceEnabled } = useLessonsSequence(course?.id);

  const chapters = useMemo(
    () => getChaptersWithAccess(course?.chapters || [], sequenceEnabled),
    [course?.chapters, sequenceEnabled],
  );

  return (
    <div className="flex flex-col gap-y-4 rounded-lg bg-white px-4 py-6 md:p-8">
      <div className="flex flex-col gap-y-1">
        <h4 className="h6 text-neutral-950">{t("studentCourseView.header")}</h4>
        <p className="body-base-md text-neutral-800">{t("studentCourseView.subHeader")}</p>
      </div>
      {chapters.map((chapter) => {
        if (!chapter) return null;
        return (
          <CourseChapter
            key={chapter.id}
            chapter={chapter}
            courseId={course!.id}
            isEnrolled={Boolean(course?.enrolled)}
          />
        );
      })}
    </div>
  );
}
