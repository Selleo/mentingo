import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";
import { LessonType, type Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";
import { LessonTypeIcon } from "~/modules/Courses/CourseView/LessonTypeIcon";
import { getLessonTypeTranslationKey } from "~/modules/Courses/CourseView/lessonTypes";

import { CURRICULUM_HANDLES } from "../../../../../../e2e/data/curriculum/handles";

import type { ReactNode } from "react";

interface LessonCardProps {
  item: Lesson;
  onClickLessonCard: (lesson: Lesson) => void;
  dragTrigger: ReactNode;
  selectedLesson: Lesson | null;
  isCourseGenerationLocked: boolean;
  baseLanguageLesson?: Lesson;
}

const LessonCard = ({
  item,
  onClickLessonCard,
  dragTrigger,
  selectedLesson,
  isCourseGenerationLocked,
  baseLanguageLesson,
}: LessonCardProps) => {
  const { t } = useTranslation();
  const displayTitle = item.title || baseLanguageLesson?.title || "";
  const isUsingBaseLanguageTitle = !item.title && Boolean(baseLanguageLesson?.title);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onClickLessonCard(item);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick({} as React.MouseEvent<HTMLDivElement>);
    }
  };

  const contentTypeKey = useMemo(() => getLessonTypeTranslationKey(item.type), [item.type]);

  return (
    <div
      key={item.id}
      data-testid={CURRICULUM_HANDLES.lessonCard(item.id)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isCourseGenerationLocked ? -1 : 0}
      role="button"
      aria-disabled={isCourseGenerationLocked}
      aria-label={`Lesson: ${displayTitle}`}
      className={cn(
        "flex gap-x-3 rounded-lg border bg-white p-3 hover:border-neutral-300 hover:bg-neutral-50",
        {
          "border-neutral-200": selectedLesson?.id !== item.id,
          "border-primary-500 bg-primary-50": selectedLesson?.id === item.id,
          "cursor-not-allowed opacity-60 hover:border-neutral-200 hover:bg-white":
            isCourseGenerationLocked,
        },
      )}
    >
      {dragTrigger}
      <div className="flex min-w-0 items-start gap-x-2">
        <LessonTypeIcon type={item.type} className="size-6 shrink-0 text-primary-700" />
        <hgroup className="min-w-0">
          <p
            className={cn("text-l break-words", {
              "text-neutral-500": isUsingBaseLanguageTitle,
              "text-neutral-950": !isUsingBaseLanguageTitle,
            })}
            title={displayTitle}
            data-testid={CURRICULUM_HANDLES.lessonTitle(item.id)}
          >
            {item.type === LessonType.QUIZ ? (
              <>
                {displayTitle}{" "}
                <span className="text-neutral-600">({item.questions?.length || 0})</span>
              </>
            ) : (
              displayTitle
            )}
          </p>
          <p
            className="details text-neutral-600 truncate"
            title={t(contentTypeKey, { defaultValue: item.type })}
          >
            {t(contentTypeKey, { defaultValue: item.type })}
          </p>
        </hgroup>
      </div>
    </div>
  );
};

export default LessonCard;
