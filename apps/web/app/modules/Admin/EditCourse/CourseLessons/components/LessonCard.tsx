import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { cn } from "~/lib/utils";
import { LessonType, type Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

import { mapTypeToIcon } from "../CourseLessons.helpers";

import type { ReactNode } from "react";
import type { IconName } from "~/types/shared";

interface LessonCardProps {
  item: Lesson;
  onClickLessonCard: (lesson: Lesson) => void;
  dragTrigger: ReactNode;
  selectedLesson: Lesson | null;
}

const LessonCard = ({ item, onClickLessonCard, dragTrigger, selectedLesson }: LessonCardProps) => {
  const contentType = item.type === "file" ? item.fileType : item.type;
  const { t } = useTranslation();

  const getIcon = useMemo(() => mapTypeToIcon(contentType as string), [contentType]);

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

  return (
    <div
      key={item.id}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Lesson: ${item.title}`}
      className={cn(
        "flex gap-x-3 rounded-lg border bg-white p-3 hover:border-neutral-300 hover:bg-neutral-50",
        {
          "border-neutral-200": selectedLesson?.id !== item.id,
          "border-primary-500 bg-primary-50": selectedLesson?.id === item.id,
        },
      )}
    >
      {dragTrigger}
      <div className="flex items-start gap-x-2">
        <Icon name={getIcon as IconName} className="size-6 text-primary-700" />
        <hgroup>
          <p className="text-l">
            {item.type === LessonType.QUIZ ? (
              <>
                {item.title}{" "}
                <span className="text-neutral-600">({item.questions?.length || 0})</span>
              </>
            ) : (
              item.title
            )}
          </p>
          <p className="details text-neutral-600">
            {t(`adminCoursesView.lessonCard.mappedTypes.${contentType}`)}
          </p>
        </hgroup>
      </div>
    </div>
  );
};

export default LessonCard;
