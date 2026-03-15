import { PERMISSIONS } from "@repo/shared";

type LessonLearningAccess = {
  hasEnrollment: boolean;
  isLearningModeActive: boolean;
};

export const LEARNING_MODE_REQUIRED_ERROR_KEY =
  "studentCourseView.studentMode.learningModeRequired";

export function canUseLessonProgressAsLearner(
  permissions: string[] | undefined,
  access: LessonLearningAccess,
) {
  if (!permissions?.includes(PERMISSIONS.LEARNING_MODE_USE)) return true;

  if (permissions.includes(PERMISSIONS.TENANT_MANAGE)) {
    return access.isLearningModeActive;
  }

  if (
    permissions.includes(PERMISSIONS.COURSE_UPDATE) ||
    permissions.includes(PERMISSIONS.COURSE_UPDATE_OWN)
  ) {
    return access.hasEnrollment || access.isLearningModeActive;
  }

  return false;
}
