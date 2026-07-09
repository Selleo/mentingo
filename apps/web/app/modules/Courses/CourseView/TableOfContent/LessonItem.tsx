import { cn } from "~/lib/utils";

import LessonStatusIcon from "./LessonStatusIcon";
import LessonTypeIcon from "./LessonTypeIcon";

import type { GetCourseResponse } from "~/api/generated-api";

type CourseLesson = GetCourseResponse["data"]["chapters"][number]["lessons"][number];

type LessonItemProps = {
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
    return "hover:bg-green-50/30";
  }

  if (isCurrent) {
    return "hover:bg-blue-50/30";
  }

  return "hover:bg-gray-50/30";
};

export default function LessonItem({
  isAdminExperience,
  isCompleted,
  isCurrent,
  isLast,
  lesson,
}: LessonItemProps) {
  return (
    <div>
      <div
        className={cn(
          "flex cursor-pointer items-center gap-3 py-4 transition-all group/lesson md:py-3",
          getLessonHoverStyle({ isCompleted, isCurrent }),
        )}
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg md:h-8 md:w-8">
          <LessonTypeIcon type={lesson.type} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium leading-relaxed text-[#363636] transition-colors group-hover/lesson:text-[#3f58b6] md:text-sm">
            {lesson.title}
          </p>
        </div>
        {!isAdminExperience && <LessonStatusIcon status={lesson.status} />}
      </div>
      {!isLast && <div className="ml-12 border-t border-[#e5e5e5] md:ml-11" />}
    </div>
  );
}
