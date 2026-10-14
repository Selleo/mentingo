import { COURSE_STATUSES, PERMISSIONS, SUPPORTED_LANGUAGES } from "@repo/shared";

import { CourseService } from "./course.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

const actor: CurrentUserType = {
  userId: "00000000-0000-4000-8000-000000000001",
  tenantId: "00000000-0000-4000-8000-000000000002",
  email: "author@example.test",
  roleSlugs: [],
  permissions: [PERMISSIONS.COURSE_READ, PERMISSIONS.COURSE_READ_ASSIGNED],
};
const id = "00000000-0000-4000-8000-000000000003";
function fixture(status: string, enrolled: boolean, isArchived = false) {
  const where = jest
    .fn()
    .mockResolvedValueOnce([{ authorId: actor.userId }])
    .mockResolvedValueOnce([{ id, authorId: actor.userId, status, enrolled, isArchived }]);
  const query = { from: jest.fn(), leftJoin: jest.fn(), where };
  query.from.mockReturnValue(query);
  query.leftJoin.mockReturnValue(query);
  const db = { select: jest.fn().mockReturnValue(query) };
  const service = Object.assign(Object.create(CourseService.prototype), {
    db,
    ensureAnonymousCourseAccess: jest.fn().mockResolvedValue(undefined),
    courseSlugService: {
      getCourseIdBySlug: jest
        .fn()
        .mockResolvedValue({ type: "found", courseId: id, slug: "course" }),
    },
    isCourseStudentModeEnabled: jest.fn().mockResolvedValue(false),
    localizationService: { getLocalizedSqlField: jest.fn(), getFieldByLanguage: jest.fn() },
    getLocalizedLearningOutcomes: jest.fn(),
  }) as CourseService;
  return { service, db };
}
describe("trusted learner course reads", () => {
  it.each([
    [COURSE_STATUSES.DRAFT, false, false],
    [COURSE_STATUSES.DRAFT, true, false],
    [COURSE_STATUSES.PRIVATE, false, false],
    [COURSE_STATUSES.PUBLISHED, true, true],
  ])(
    "rejects authored course status=%s enrolled=%s archived=%s before loading chapters",
    async (status, enrolled, archived) => {
      const { service, db } = fixture(status as string, enrolled as boolean, archived as boolean);
      await expect(
        service.getCourse(id, actor, SUPPORTED_LANGUAGES.EN, { learnerOnly: true }),
      ).rejects.toThrow();
      expect(db.select).toHaveBeenCalledTimes(2);
    },
  );
});
