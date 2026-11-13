import { PERMISSIONS } from "@repo/shared";

import { hasAnyPermission, hasPermission } from "src/common/permissions/permission.utils";

import type { AiRepository } from "src/ai/repositories/ai.repository";
import type { CurrentUserType } from "src/common/types/current-user.type";

/**
 * Must run inside the caller's tenant context, so a lesson from another tenant resolves to no author.
 * `COURSE_UPDATE_OWN` only grants preview of lessons the caller authored.
 */
export async function canPreviewAiMentorLesson(
  aiRepository: AiRepository,
  lessonId: string,
  user: Pick<CurrentUserType, "userId" | "permissions">,
): Promise<boolean> {
  if (!hasPermission(user.permissions, PERMISSIONS.AI_USE)) return false;
  if (
    !hasAnyPermission(user.permissions, [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN])
  )
    return false;

  const authorId = await aiRepository.getCourseAuthorByLesson(lessonId);
  if (!authorId) return false;

  return hasPermission(user.permissions, PERMISSIONS.COURSE_UPDATE) || authorId === user.userId;
}
