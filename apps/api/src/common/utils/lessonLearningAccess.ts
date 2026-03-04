import { USER_ROLES, type UserRole } from "src/user/schemas/userRoles";

type LessonLearningAccess = {
  hasEnrollment: boolean;
  isLearningModeActive: boolean;
};

export const LEARNING_MODE_REQUIRED_ERROR_KEY =
  "studentCourseView.studentMode.learningModeRequired";

export function canUseLessonProgressAsLearner(
  userRole: UserRole | undefined,
  access: LessonLearningAccess,
) {
  if (!userRole || userRole === USER_ROLES.STUDENT) return true;

  if (userRole === USER_ROLES.ADMIN) {
    return access.isLearningModeActive;
  }

  if (userRole === USER_ROLES.CONTENT_CREATOR) {
    return access.hasEnrollment || access.isLearningModeActive;
  }

  return false;
}
