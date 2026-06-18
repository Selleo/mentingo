import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { ProgressBadge } from "~/components/Badges/ProgressBadge";
import { cn } from "~/lib/utils";
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { LessonTypeIcon } from "~/modules/Courses/CourseView/LessonTypeIcon";
import { getLessonTypeTranslationKey } from "~/modules/Courses/CourseView/lessonTypes";

import { LESSON_PROGRESS_STATUSES } from "../Lesson/types";

import type { Lesson } from "./CourseChapter";
import type { ProgressStatus } from "../Lesson/types";

const progressBadge = {
  completed: "completed",
  in_progress: "inProgress",
  not_started: "notStarted",
  blocked: "blocked",
} as const;

type CourseChapterLessonProps = {
  lesson: Lesson;
};

export const CourseChapterLesson = ({ lesson }: CourseChapterLessonProps) => {
  const { t } = useTranslation();
  const { isCourseStudentModeActive, isPreviewMode } = useCourseAccessProvider();

  const hasAccess = isPreviewMode || lesson.hasAccess;

  const shouldIgnoreEnrollmentBlockedStatus =
    isCourseStudentModeActive &&
    lesson.hasAccess &&
    lesson.status === LESSON_PROGRESS_STATUSES.BLOCKED;

  const effectiveStatus = shouldIgnoreEnrollmentBlockedStatus
    ? LESSON_PROGRESS_STATUSES.NOT_STARTED
    : lesson.status;

  const badgeProgress: ProgressStatus = match({ isPreviewMode, hasAccess })
    .with({ isPreviewMode: true }, () => LESSON_PROGRESS_STATUSES.NOT_STARTED)
    .with({ hasAccess: true }, () => effectiveStatus)
    .otherwise(() => LESSON_PROGRESS_STATUSES.BLOCKED);

  const lessonElement = (
    <div
      className={cn("flex w-full gap-x-2 p-2", {
        "opacity-30": !hasAccess && !isPreviewMode,
      })}
    >
      <LessonTypeIcon type={lesson.type} className="size-6 text-accent-foreground" />
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
      {!isPreviewMode && (
        <ProgressBadge progress={progressBadge[badgeProgress]} className="self-center" />
      )}
    </div>
  );

  if (!hasAccess && !isPreviewMode) {
    return <button className="w-full flex cursor-not-allowed">{lessonElement}</button>;
  }

  return lessonElement;
};
