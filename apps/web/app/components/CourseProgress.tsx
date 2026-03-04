import { cn } from "~/lib/utils";

type CourseProgressProps = {
  label: string;
  completedLessonCount: number;
  courseLessonCount: number;
  isCompleted?: boolean;
  redactProgress?: boolean;
};

const CourseProgress = ({
  label,
  completedLessonCount,
  courseLessonCount,
  isCompleted = false,
  redactProgress = false,
}: CourseProgressProps) => {
  const getCourseProgressParts = () => {
    return Array.from({ length: courseLessonCount }).map((_, index) => (
      <span
        key={index}
        className={cn("h-[5px] flex-grow rounded-[40px]", {
          "bg-success-500": isCompleted,
          "bg-secondary-500": index < completedLessonCount && !isCompleted,
        })}
      />
    ));
  };

  const courseProgressParts = getCourseProgressParts();

  return (
    <div className="flex flex-col gap-2">
      {!redactProgress ? (
        <>
          <p className="text-xs text-neutral-600">
            {label} {completedLessonCount}/{courseLessonCount}
          </p>
          <div className="flex items-center justify-between gap-px">{courseProgressParts}</div>
        </>
      ) : null}
    </div>
  );
};

export default CourseProgress;
