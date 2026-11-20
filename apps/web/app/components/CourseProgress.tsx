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
        className={cn("h-2 flex-grow rounded-full bg-neutral-100 transition-colors duration-500", {
          "bg-success-500 shadow-[0_0_10px_-2px_var(--success-500)]": isCompleted,
          "bg-secondary-500 shadow-[0_0_10px_-2px_var(--secondary-500)]":
            index < completedLessonCount && !isCompleted,
        })}
      />
    ));
  };

  const courseProgressParts = getCourseProgressParts();

  return (
    <div className="flex flex-col gap-2">
      {!redactProgress && (
        <>
          <p className="text-xs font-semibold text-neutral-800">
            {label}{" "}
            <span className="font-extrabold text-neutral-950">
              {completedLessonCount}/{courseLessonCount}
            </span>
          </p>
          <div className="flex items-center justify-between gap-0.5">{courseProgressParts}</div>
        </>
      )}
    </div>
  );
};

export default CourseProgress;
