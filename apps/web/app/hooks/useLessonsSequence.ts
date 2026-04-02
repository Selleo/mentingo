import { PERMISSIONS } from "@repo/shared";

import { useLessonSequence } from "~/api/queries/useLessonSequence";

import { usePermissions } from "./usePermissions";

export function useLessonsSequence(courseId?: string) {
  const { data: lessonSequence } = useLessonSequence({ courseId });

  const { hasAccess: canUpdateLearningProgress } = usePermissions({
    required: PERMISSIONS.LEARNING_PROGRESS_UPDATE,
  });

  const sequenceEnabled = canUpdateLearningProgress && lessonSequence?.data.lessonSequenceEnabled;

  return { sequenceEnabled };
}
