import { findFirstInProgressLessonId, findFirstNotStartedLessonId } from "../Lesson/utils";

import type { NavigateFunction } from "@remix-run/react";
import type { GetCourseResponse } from "~/api/generated-api";

export const navigateToNextLesson = (
  course: GetCourseResponse["data"],
  navigate: NavigateFunction,
) => {
  const notStartedLessonId = findFirstNotStartedLessonId(course);
  const notStartedChapterId = course.chapters.find((chapter) =>
    chapter.lessons.some(({ id }) => id === notStartedLessonId),
  )?.id;
  const firstInProgressLessonId = findFirstInProgressLessonId(course);
  const firstInProgressChapterId = course.chapters.find((chapter) =>
    chapter.lessons.some(({ id }) => id === firstInProgressLessonId),
  )?.id;
  const firstLessonId = course.chapters[0]?.lessons[0]?.id;

  if (!notStartedLessonId && !firstInProgressLessonId) {
    return navigate(`/course/${course.slug}/lesson/${firstLessonId}`);
  }

  navigate(`/course/${course.slug}/lesson/${notStartedLessonId ?? firstInProgressLessonId}`, {
    state: { chapterId: notStartedChapterId ?? firstInProgressChapterId },
  });
};
