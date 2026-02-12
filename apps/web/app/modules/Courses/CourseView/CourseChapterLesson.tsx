import { useTranslation } from "react-i18next";

import { ProgressBadge } from "~/components/Badges/ProgressBadge";
import { Icon } from "~/components/Icon";
import { cn } from "~/lib/utils";
import {
  getLessonTypeTranslationKey,
  LessonTypesIcons,
} from "~/modules/Courses/CourseView/lessonTypes";

import type { Lesson } from "./CourseChapter";

const progressBadge = {
  completed: "completed",
  in_progress: "inProgress",
  not_started: "notStarted",
  blocked: "blocked",
} as const;

type CourseChapterLessonProps = {
  lesson: Lesson;
  isPreviewMode?: boolean;
};

export const CourseChapterLesson = ({
  lesson,
  isPreviewMode = false,
}: CourseChapterLessonProps) => {
  const { t } = useTranslation();
  const hasAccess = isPreviewMode || lesson.hasAccess;

  const lessonElement = (
    <div
      className={cn("flex w-full gap-x-2 p-2", {
        "opacity-30": !hasAccess && !isPreviewMode,
      })}
    >
      <Icon name={LessonTypesIcons[lesson.type]} className="size-6 text-accent-foreground" />
      <div className="flex w-full flex-col justify-center">
        <p
          className="body-sm-md text-neutral-950 break-all overflow-x-hidden text-left"
          data-testid="lesson-title"
        >
          {lesson.title}{" "}
          <span className="text-neutral-800">
            {lesson.quizQuestionCount ? `(${lesson.quizQuestionCount})` : null}
          </span>
        </p>
        <span className="details text-neutral-800 text-left">
          {t(getLessonTypeTranslationKey(lesson.type), { defaultValue: lesson.type })}
        </span>
      </div>
      <ProgressBadge
        progress={progressBadge[hasAccess ? lesson.status : "blocked"]}
        className={cn("self-center", { invisible: isPreviewMode })}
      />
    </div>
  );

  if (!hasAccess && !isPreviewMode) {
    return <button className="w-full flex cursor-not-allowed">{lessonElement}</button>;
  }

  return lessonElement;
};
