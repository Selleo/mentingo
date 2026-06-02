import { PERMISSIONS, type PermissionKey } from "@repo/shared";

export const LEARNING_MODE_REQUIRED_ERROR_KEY =
  "studentCourseView.studentMode.learningModeRequired";

type LessonProgressAccess = {
  hasEnrollment: boolean;
  isCourseAuthor: boolean;
  isLearningModeActive: boolean;
};

export const canTrackLessonProgress = (
  permissions: PermissionKey[],
  access: LessonProgressAccess,
) => {
  const canUpdateLearningProgress = permissions.includes(PERMISSIONS.LEARNING_PROGRESS_UPDATE);
  const canUseLearningMode = permissions.includes(PERMISSIONS.LEARNING_MODE_USE);

  if (canUseLearningMode && !canUpdateLearningProgress) return access.isLearningModeActive;

  if (canUseLearningMode && access.isCourseAuthor) return access.isLearningModeActive;

  if (canUpdateLearningProgress) return access.hasEnrollment || access.isLearningModeActive;

  return false;
};

export const shouldRequireLearningModeForProgress = (
  permissions: PermissionKey[],
  access: Pick<LessonProgressAccess, "isCourseAuthor">,
) => {
  const canUseLearningMode = permissions.includes(PERMISSIONS.LEARNING_MODE_USE);
  if (!canUseLearningMode) return false;

  const canUpdateLearningProgress = permissions.includes(PERMISSIONS.LEARNING_PROGRESS_UPDATE);
  return access.isCourseAuthor || !canUpdateLearningProgress;
};
