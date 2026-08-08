import { Link } from "@remix-run/react";
import { LESSON_TYPES } from "@repo/shared";

import { useCurrentUser } from "~/api/queries";
import { cn } from "~/lib/utils";
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { LESSON_PROGRESS_STATUSES } from "~/modules/Courses/Lesson/types";

import LessonStatusIcon from "./LessonStatusIcon";
import LessonTypeIcon from "./LessonTypeIcon";

import type { GetCourseResponse } from "~/api/generated-api";

type CourseLesson = GetCourseResponse["data"]["chapters"][number]["lessons"][number] & {
  hasAccess: boolean;
};

type LessonItemProps = {
  courseSlug: string;
  isAdminExperience: boolean;
  isCompleted: boolean;
  isCurrent: boolean;
  isLast: boolean;
  isFreemiumChapter: boolean;
  lesson: CourseLesson;
};

const getLessonHoverStyle = ({
  isCompleted,
  isCurrent,
}: {
  isCompleted: boolean;
  isCurrent: boolean;
}) => {
  if (isCompleted) {
    return "hover:bg-success-50/30";
  }

  if (isCurrent) {
    return "hover:bg-primary-50/30";
  }

  return "hover:bg-neutral-50/30";
};

export default function LessonItem({
  courseSlug,
  isAdminExperience,
  isCompleted,
  isCurrent,
  isLast,
  isFreemiumChapter,
  lesson,
}: LessonItemProps) {
  const { data: currentUser } = useCurrentUser();
  const { course, isCourseStudentModeActive, isPreviewMode } = useCourseAccessProvider();
  const isPublicVisitor = !currentUser;
  const hasPublicVisitorAccess =
    isPublicVisitor && isFreemiumChapter && lesson.type === LESSON_TYPES.CONTENT;
  const hasCourseLearningAccess =
    hasPublicVisitorAccess ||
    (!isPublicVisitor &&
      (isFreemiumChapter || Boolean(course.enrolled) || isCourseStudentModeActive));
  const canOpenLesson =
    (isPreviewMode && !isPublicVisitor) || (hasCourseLearningAccess && lesson.hasAccess);
  const lessonStatus = canOpenLesson ? lesson.status : LESSON_PROGRESS_STATUSES.BLOCKED;
  const lessonContent = (
    <>
      <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-lg md:size-8">
        <LessonTypeIcon type={lesson.type} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium leading-relaxed text-neutral-950 transition-colors group-hover/lesson:text-primary-700 md:text-sm">
          {lesson.title}
        </p>
      </div>
      {!isAdminExperience && <LessonStatusIcon status={lessonStatus} />}
    </>
  );
  const lessonClassName = cn(
    "flex items-center gap-3 py-4 transition-all group/lesson md:py-3",
    {
      "cursor-pointer": canOpenLesson,
      "cursor-not-allowed opacity-50": !canOpenLesson,
    },
    canOpenLesson && getLessonHoverStyle({ isCompleted, isCurrent }),
  );

  return (
    <div>
      {canOpenLesson ? (
        <Link to={`/course/${courseSlug}/lesson/${lesson.id}`} className={lessonClassName}>
          {lessonContent}
        </Link>
      ) : (
        <div aria-disabled="true" className={lessonClassName}>
          {lessonContent}
        </div>
      )}
      {!isLast && <div className="ml-12 border-t border-neutral-200 md:ml-11" />}
    </div>
  );
}
