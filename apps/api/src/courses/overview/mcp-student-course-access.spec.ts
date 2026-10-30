import { COURSE_STATUSES, PERMISSIONS, SUPPORTED_LANGUAGES } from "@repo/shared";

import { CourseDetailService } from "./course-detail.service";

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
  const courseDetailRepository = {
    findCourseAuthorId: jest.fn().mockResolvedValue(actor.userId),
    findCourseDetail: jest
      .fn()
      .mockResolvedValue({ id, authorId: actor.userId, status, enrolled, isArchived }),
    findCourseChaptersWithProgress: jest.fn(),
  };
  const service = Object.assign(Object.create(CourseDetailService.prototype), {
    courseDetailRepository,
    courseSlugService: {
      getCourseIdBySlug: jest
        .fn()
        .mockResolvedValue({ type: "found", courseId: id, slug: "course" }),
    },
    courseStudentModeService: { isCourseStudentModeEnabled: jest.fn().mockResolvedValue(false) },
  }) as CourseDetailService;
  return { service, courseDetailRepository };
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
      const { service, courseDetailRepository } = fixture(
        status as string,
        enrolled as boolean,
        archived as boolean,
      );
      await expect(
        service.getCourse(id, actor, SUPPORTED_LANGUAGES.EN, { learnerOnly: true }),
      ).rejects.toThrow();
      expect(courseDetailRepository.findCourseDetail).toHaveBeenCalledTimes(1);
      expect(courseDetailRepository.findCourseChaptersWithProgress).not.toHaveBeenCalled();
    },
  );
});
