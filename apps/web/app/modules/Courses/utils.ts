import type { GetCourseResponse } from "~/api/generated-api";

// Build chapters with strict sequential access across the whole course:
// - Completed lessons are accessible
// - The first not-completed lesson (not_started or in_progress) is accessible
// - Any later not-completed lessons are not accessible
export const getChaptersWithAccess = (
  chapters: GetCourseResponse["data"]["chapters"],
  sequenceEnabled?: boolean,
) => {
  let firstIncompleteSeen = false;

  return (
    chapters.map((chapter) => {
      const lessonsWithAccess = chapter.lessons.map((lesson) => {
        if (!sequenceEnabled) {
          return { ...lesson, hasAccess: true };
        }

        const isCompleted = lesson.status === "completed";
        const hasAccess = !firstIncompleteSeen || isCompleted;
        if (!isCompleted && !firstIncompleteSeen) {
          firstIncompleteSeen = true;
        }
        return { ...lesson, hasAccess };
      });
      return { ...chapter, lessons: lessonsWithAccess };
    }) ?? []
  );
};
