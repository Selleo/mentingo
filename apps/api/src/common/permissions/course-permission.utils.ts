import { PERMISSIONS } from "@repo/shared";

import { hasPermission } from "./permission.utils";

import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

export const canUpdateCourseByAuthor = (
  currentUser: CurrentUserType,
  authorId: UUIDType,
): boolean => {
  const canUpdateAnyCourse = hasPermission(currentUser.permissions, PERMISSIONS.COURSE_UPDATE);
  const canUpdateOwnCourse = hasPermission(currentUser.permissions, PERMISSIONS.COURSE_UPDATE_OWN);

  return canUpdateAnyCourse || (canUpdateOwnCourse && currentUser.userId === authorId);
};
