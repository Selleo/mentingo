import { cn } from "~/lib/utils";

type CourseProgressProps = {
  label: string;
  completedLessonCount: number;
  courseLessonCount: number;
  isCompleted?: boolean;
};

const CourseProgress = ({
  label,
  completedLessonCount,
  courseLessonCount,
  isCompleted = false,
}: CourseProgressProps) => {
  const getCourseProgressParts = () => {
    return Array.from({ length: courseLessonCount }).map((_, index) => (
      <span
        key={index}
        className={cn("h-[5px] flex-grow rounded-[40px]", {
          "bg-success-500": isCompleted,
          "bg-secondary-500": index < completedLessonCount && !isCompleted,
          "bg-primary-50":
            (index >= completedLessonCount || completedLessonCount === 0) && !isCompleted,
        })}
      />
    ));
  };

  const courseProgressParts = getCourseProgressParts();

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-neutral-600">
        {label} {completedLessonCount}/{courseLessonCount}
      </p>
      <div className="flex items-center justify-between gap-px">{courseProgressParts}</div>
    </div>
  );
};

export default CourseProgress;
