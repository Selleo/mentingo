import { Link } from "@remix-run/react";

import { cn } from "~/lib/utils";

import LessonStatusIcon from "./LessonStatusIcon";
import LessonTypeIcon from "./LessonTypeIcon";

import type { GetCourseResponse } from "~/api/generated-api";

type CourseLesson = GetCourseResponse["data"]["chapters"][number]["lessons"][number];

type LessonItemProps = {
  courseSlug: string;
  isAdminExperience: boolean;
  isCompleted: boolean;
  isCurrent: boolean;
  isLast: boolean;
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
  lesson,
}: LessonItemProps) {
  return (
    <div>
      <Link
        to={`/course/${courseSlug}/lesson/${lesson.id}`}
        className={cn(
          "flex cursor-pointer items-center gap-3 py-4 transition-all group/lesson md:py-3",
          getLessonHoverStyle({ isCompleted, isCurrent }),
        )}
      >
        <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-lg md:size-8">
          <LessonTypeIcon type={lesson.type} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium leading-relaxed text-neutral-950 transition-colors group-hover/lesson:text-primary-700 md:text-sm">
            {lesson.title}
          </p>
        </div>
        {!isAdminExperience && <LessonStatusIcon status={lesson.status} />}
      </Link>
      {!isLast && <div className="ml-12 border-t border-neutral-200 md:ml-11" />}
    </div>
  );
}
