import { ProgressBadge } from "~/components/Badges/ProgressBadge";
import { Icon } from "~/components/Icon";
import { cn } from "~/lib/utils";
import { LessonTypes, LessonTypesIcons } from "~/modules/Courses/CourseView/lessonTypes";

import type { Lesson } from "./CourseChapter";

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
  const hasAccess = lesson.hasAccess;

  const lessonElement = (
    <div
      className={cn("flex w-full gap-x-2 p-2", {
        "opacity-30": !hasAccess,
      })}
    >
      <Icon name={LessonTypesIcons[lesson.type]} className="size-6 text-accent-foreground" />
      <div className="flex w-full flex-col justify-center">
        <p className="body-sm-md text-neutral-950 break-all overflow-x-hidden text-left">
          {lesson.title}{" "}
          <span className="text-neutral-800">
            {lesson.quizQuestionCount ? `(${lesson.quizQuestionCount})` : null}
          </span>
        </p>
        <span className="details text-neutral-800 text-left">{LessonTypes[lesson.type]}</span>
      </div>
      <ProgressBadge
        progress={progressBadge[hasAccess ? lesson.status : "blocked"]}
        className="self-center"
      />
    </div>
  );

  if (!hasAccess) {
    return <button className="w-full flex cursor-not-allowed">{lessonElement}</button>;
  }

  return lessonElement;
};
