import { useCurrentUser } from "~/api/queries";
import { useLessonSequence } from "~/api/queries/useLessonSequence";

export function useLessonsSequence(courseId?: string) {
  const { data: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const { data: lessonSequence, isLoading: isLessonSequenceLoading } = useLessonSequence({
    courseId,
    enabled: Boolean(currentUser),
  });

  const sequenceEnabled = currentUser
    ? (lessonSequence?.data.lessonSequenceEnabled ?? false)
    : false;

  return { sequenceEnabled, isLoading: isCurrentUserLoading || isLessonSequenceLoading };
}
