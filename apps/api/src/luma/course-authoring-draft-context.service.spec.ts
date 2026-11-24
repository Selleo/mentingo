import { PERMISSIONS } from "@repo/shared";

import { CourseAuthoringDraftContextService } from "./course-authoring-draft-context.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

const actor: CurrentUserType = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
  email: "author@example.test",
  roleSlugs: [],
  permissions: [],
};
const placeholderId = "00000000-0000-4000-8000-000000000003";
const sessionId = "00000000-0000-4000-8000-000000000004";
const nativeCourseId = "00000000-0000-4000-8000-000000000005";

describe(CourseAuthoringDraftContextService.name, () => {
  function setup() {
    const draft = {
      id: placeholderId,
      tenantId: actor.tenantId,
      ownerId: actor.userId,
      lumaSessionId: sessionId,
      courseId: null,
      expiredAt: null,
    };
    const getUserAccess = jest.fn().mockResolvedValue({
      roleSlugs: [],
      permissions: [PERMISSIONS.COURSE_AI_GENERATION, PERMISSIONS.COURSE_CREATE],
    });
    const find = jest.fn().mockResolvedValue(draft);
    const touch = jest.fn().mockResolvedValue(draft);
    const service = new CourseAuthoringDraftContextService(
      {} as ConstructorParameters<typeof CourseAuthoringDraftContextService>[0],
      { getUserAccess } as unknown as ConstructorParameters<
        typeof CourseAuthoringDraftContextService
      >[1],
      { find, touch } as unknown as ConstructorParameters<
        typeof CourseAuthoringDraftContextService
      >[2],
    );
    return { draft, find, getUserAccess, touch, service };
  }

  it("rechecks permissions without recording activity for a read-only delivery", async () => {
    const { draft, getUserAccess, service, touch } = setup();

    await expect(service.access(placeholderId, sessionId, actor, false)).resolves.toMatchObject({
      draft,
    });

    expect(getUserAccess).toHaveBeenCalledWith(actor.userId);
    expect(touch).not.toHaveBeenCalled();
  });

  it("returns the attached course binding if creation wins a race with the activity refresh", async () => {
    const { draft, service, touch } = setup();
    touch.mockResolvedValue({ ...draft, courseId: nativeCourseId });

    await expect(service.access(placeholderId, sessionId, actor)).resolves.toMatchObject({
      draft: { courseId: nativeCourseId },
    });
  });

  it("rejects an expired draft without refreshing activity", async () => {
    const { draft, find, service, touch } = setup();
    find.mockResolvedValue({ ...draft, expiredAt: "2026-11-24T09:00:00.000Z" });

    await expect(service.access(placeholderId, sessionId, actor, false)).rejects.toThrow(
      "courseAuthoring.draft.expired",
    );
    expect(touch).not.toHaveBeenCalled();
  });
});
