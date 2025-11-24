import { useLessonSequence } from "~/api/queries/useLessonSequence";

import { useUserRole } from "./useUserRole";

export function useLessonsSequence(courseId?: string) {
  const { data: lessonSequence } = useLessonSequence({ courseId });
  const { isStudent } = useUserRole();

  const sequenceEnabled = isStudent && lessonSequence?.data.lessonSequenceEnabled;

  return { sequenceEnabled };
}
