import { PERMISSIONS } from "@repo/shared";

import { hasPermission } from "src/common/permissions/permission.utils";

import type { AiRepository } from "src/ai/repositories/ai.repository";
import type { CurrentUserType } from "src/common/types/current-user.type";

/**
 * Must run inside the caller's tenant context, so a lesson from another tenant resolves to no author.
 * Editors retain private lesson preview; other signed-in callers must satisfy the same public
 * course eligibility as text AI Mentor. `COURSE_UPDATE_OWN` alone never grants another author's private lesson.
 */
export async function canPreviewAiMentorLesson(
  aiRepository: AiRepository,
  lessonId: string,
  user: Pick<CurrentUserType, "userId" | "permissions">,
): Promise<boolean> {
  if (!hasPermission(user.permissions, PERMISSIONS.AI_USE)) return false;
  const authorId = await aiRepository.getCourseAuthorByLesson(lessonId);
  if (!authorId) return false;

  const canEdit =
    hasPermission(user.permissions, PERMISSIONS.COURSE_UPDATE) ||
    (hasPermission(user.permissions, PERMISSIONS.COURSE_UPDATE_OWN) && authorId === user.userId);
  if (canEdit) return true;

  return aiRepository.getHasPublicCoursePreviewAccess(lessonId, user.userId);
}
