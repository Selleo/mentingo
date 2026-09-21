import { PERMISSIONS, type PermissionKey } from "@repo/shared";

import { useCurrentUser } from "~/api/queries";
import { useLessonSequence } from "~/api/queries/useLessonSequence";
import { hasPermission } from "~/common/permissions/permission.utils";

export const canLoadLessonSequence = (permissions: PermissionKey[]) =>
  hasPermission(permissions, PERMISSIONS.COURSE_READ);

export function useLessonsSequence(courseId?: string) {
  const { data: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();

  const canReadCourse = canLoadLessonSequence(currentUser?.permissions ?? []);

  const { data: lessonSequence, isLoading: isLessonSequenceLoading } = useLessonSequence({
    courseId,
    enabled: canReadCourse,
  });

  const sequenceEnabled = currentUser
    ? (lessonSequence?.data.lessonSequenceEnabled ?? false)
    : false;

  return { sequenceEnabled, isLoading: isCurrentUserLoading || isLessonSequenceLoading };
}
