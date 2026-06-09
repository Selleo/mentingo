import {
  findFirstLessonId,
  findFirstLessonIdForCompletedCourse,
  findFirstNonCompletedLessonId,
  getCurrentChapterId,
} from "../Lesson/utils";

import type { NavigateFunction } from "@remix-run/react";
import type { GetCourseResponse } from "~/api/generated-api";

export const navigateToNextLesson = (
  course: GetCourseResponse["data"],
  navigate: NavigateFunction,
  options: { openFirstLesson?: boolean } = {},
) => {
  const lessonId = options.openFirstLesson
    ? findFirstLessonId(course)
    : (findFirstNonCompletedLessonId(course) ?? findFirstLessonIdForCompletedCourse(course));

  if (!lessonId) return;

  navigate(`/course/${course.slug}/lesson/${lessonId}`, {
    state: { chapterId: getCurrentChapterId(course, lessonId) },
  });
};
