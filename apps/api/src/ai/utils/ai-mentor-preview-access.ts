import { PERMISSIONS } from "@repo/shared";

import { hasAnyPermission } from "src/common/permissions/permission.utils";

import type { AiRepository } from "src/ai/repositories/ai.repository";
import type { CurrentUserType } from "src/common/types/current-user.type";

// Run inside the authenticated tenant context; update-own is not global course access.
export async function canPreviewAiMentorLesson(
  repository: AiRepository,
  lessonId: string,
  user: Pick<CurrentUserType, "userId" | "permissions">,
): Promise<boolean> {
  if (!hasAnyPermission(user.permissions, [PERMISSIONS.AI_USE])) return false;
  if (
    !hasAnyPermission(user.permissions, [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN])
  )
    return false;
  const authorId = await repository.getCourseAuthorByLesson(lessonId);
  return Boolean(
    authorId &&
      (hasAnyPermission(user.permissions, [PERMISSIONS.COURSE_UPDATE]) || authorId === user.userId),
  );
}
