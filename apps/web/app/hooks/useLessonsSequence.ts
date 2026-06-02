import { useLessonSequence } from "~/api/queries/useLessonSequence";

export function useLessonsSequence(courseId?: string) {
  const { data: lessonSequence, isLoading } = useLessonSequence({ courseId });

  const sequenceEnabled = lessonSequence?.data.lessonSequenceEnabled ?? false;

  return { sequenceEnabled, isLoading };
}
