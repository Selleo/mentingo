import { PERMISSIONS } from "@repo/shared";

import { canPreviewAiMentorLesson } from "./ai-mentor-preview-access";

import type { AiRepository } from "src/ai/repositories/ai.repository";
import type { CurrentUserType } from "src/common/types/current-user.type";

const lessonId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const user = { userId, permissions: [PERMISSIONS.AI_USE] };

function fixture() {
  const repository = {
    getCourseAuthorByLesson: jest.fn().mockResolvedValue("another-author"),
    getHasPublicCoursePreviewAccess: jest.fn().mockResolvedValue(false),
  };
  const canPreview = (actor: Pick<CurrentUserType, "userId" | "permissions"> = user) =>
    canPreviewAiMentorLesson(repository as unknown as AiRepository, lessonId, actor);
  return { repository, canPreview };
}

describe("AI Mentor preview eligibility", () => {
  it("allows an ordinary eligible public viewer without editor or Learn permissions", async () => {
    const { repository, canPreview } = fixture();
    repository.getHasPublicCoursePreviewAccess.mockResolvedValue(true);
    await expect(canPreview()).resolves.toBe(true);
    expect(repository.getHasPublicCoursePreviewAccess).toHaveBeenCalledWith(lessonId, userId);
  });

  it("requires AI permission before either public or editor preview", async () => {
    const { repository, canPreview } = fixture();
    repository.getHasPublicCoursePreviewAccess.mockResolvedValue(true);
    await expect(canPreview({ userId, permissions: [] })).resolves.toBe(false);
    expect(repository.getCourseAuthorByLesson).not.toHaveBeenCalled();
    expect(repository.getHasPublicCoursePreviewAccess).not.toHaveBeenCalled();
  });

  it("denies a missing or cross-tenant lesson before considering public eligibility", async () => {
    const { repository, canPreview } = fixture();
    repository.getCourseAuthorByLesson.mockResolvedValue(undefined);
    repository.getHasPublicCoursePreviewAccess.mockResolvedValue(true);
    await expect(canPreview()).resolves.toBe(false);
    expect(repository.getHasPublicCoursePreviewAccess).not.toHaveBeenCalled();
  });

  it("keeps private editor preview without depending on the public preview setting", async () => {
    const { repository, canPreview } = fixture();
    await expect(
      canPreview({ ...user, permissions: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.AI_USE] }),
    ).resolves.toBe(true);
    expect(repository.getHasPublicCoursePreviewAccess).not.toHaveBeenCalled();
  });

  it("keeps private own-course preview for its author", async () => {
    const { repository, canPreview } = fixture();
    repository.getCourseAuthorByLesson.mockResolvedValue(userId);
    await expect(
      canPreview({ ...user, permissions: [PERMISSIONS.COURSE_UPDATE_OWN, PERMISSIONS.AI_USE] }),
    ).resolves.toBe(true);
    expect(repository.getHasPublicCoursePreviewAccess).not.toHaveBeenCalled();
  });

  it("does not turn update-own permission into access to another private course", async () => {
    const { canPreview } = fixture();
    await expect(
      canPreview({ ...user, permissions: [PERMISSIONS.COURSE_UPDATE_OWN, PERMISSIONS.AI_USE] }),
    ).resolves.toBe(false);
  });

  it("allows an editor's public preview of another author's eligible course", async () => {
    const { repository, canPreview } = fixture();
    repository.getHasPublicCoursePreviewAccess.mockResolvedValue(true);
    await expect(
      canPreview({ ...user, permissions: [PERMISSIONS.COURSE_UPDATE_OWN, PERMISSIONS.AI_USE] }),
    ).resolves.toBe(true);
  });

  it("denies ordinary preview when the shared policy rejects it and rechecks every call", async () => {
    const { repository, canPreview } = fixture();
    repository.getHasPublicCoursePreviewAccess.mockResolvedValueOnce(true).mockResolvedValue(false);
    await expect(canPreview()).resolves.toBe(true);
    await expect(canPreview()).resolves.toBe(false);
    expect(repository.getHasPublicCoursePreviewAccess).toHaveBeenCalledTimes(2);
  });
});
