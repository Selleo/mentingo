import { ProgressBadge } from "~/components/Badges/ProgressBadge";
import { Icon } from "~/components/Icon";
import { LessonTypes, LessonTypesIcons } from "~/modules/Courses/CourseView/lessonTypes";

import type { GetCourseResponse } from "~/api/generated-api";

const progressBadge = {
  completed: "completed",
  in_progress: "inProgress",
  not_started: "notStarted",
  blocked: "blocked",
} as const;

type Lesson = GetCourseResponse["data"]["chapters"][number]["lessons"][number];

type CourseChapterLessonProps = {
  lesson: Lesson;
};
export const CourseChapterLesson = ({ lesson }: CourseChapterLessonProps) => {
  return (
    <div className="flex w-full gap-x-2 p-2">
      <Icon name={LessonTypesIcons[lesson.type]} className="size-6 text-accent-foreground" />
      <div className="flex w-full flex-col justify-center">
        <p className="body-sm-md text-neutral-950 break-all overflow-x-hidden">
          {lesson.title}{" "}
          <span className="text-neutral-800">
            {lesson.quizQuestionCount ? `(${lesson.quizQuestionCount})` : null}
          </span>
        </p>
        <span className="details text-neutral-800">{LessonTypes[lesson.type]}</span>
      </div>
      <ProgressBadge progress={progressBadge[lesson.status]} className="self-center" />
    </div>
  );
};
