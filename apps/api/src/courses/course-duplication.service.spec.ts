import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { COURSE_TYPE, PERMISSIONS } from "@repo/shared";

import { CourseDuplicationService } from "src/courses/course-duplication.service";

import type { UUIDType } from "src/common";
import type { CourseDuplicationQueueService } from "src/courses/course-duplication.queue.service";
import type { CourseDuplicationRepository } from "src/courses/course-duplication.repository";
import type { CourseDuplicationSourceCourse } from "src/courses/course-duplication.types";
import type { MasterCourseService } from "src/courses/master-course.service";
import type { SearchIndexService } from "src/global-search/search-index.service";
import type { WsGateway } from "src/websocket";

describe("CourseDuplicationService", () => {
  const sourceCourse = {
    id: "source-course-id",
    title: { en: "Source course" },
    description: { en: "Description" },
    baseLanguage: "en",
    availableLocales: ["en"],
    authorId: "source-author-id",
    categoryId: "category-id",
    currency: "usd",
    courseType: COURSE_TYPE.DEFAULT,
    settings: {},
  } as CourseDuplicationSourceCourse;

  const actor = {
    userId: "other-user-id",
    email: "other@example.com",
    roleSlugs: [],
    permissions: [PERMISSIONS.COURSE_CREATE, PERMISSIONS.COURSE_UPDATE_OWN],
    tenantId: "tenant-id",
  };

  const createService = (sourceCourseRow?: CourseDuplicationSourceCourse) => {
    const repository = {
      getSourceCourse: jest.fn().mockResolvedValue(sourceCourseRow),
      createDraftDuplicateCourse: jest.fn().mockResolvedValue("target-course-id" as UUIDType),
    } as unknown as jest.Mocked<CourseDuplicationRepository>;

    const queueService = {
      enqueueDuplication: jest.fn().mockResolvedValue({ id: "duplication-job-id" }),
      getJobStatus: jest.fn(),
    } as unknown as jest.Mocked<CourseDuplicationQueueService>;

    const service = new CourseDuplicationService(
      repository,
      queueService,
      {} as MasterCourseService,
      {} as SearchIndexService,
      {} as WsGateway,
    );

    return { service, repository, queueService };
  };

  it("rejects users without manage access to the source course", async () => {
    const { service, repository, queueService } = createService(sourceCourse);

    await expect(service.duplicateCourse(sourceCourse.id, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.createDraftDuplicateCourse).not.toHaveBeenCalled();
    expect(queueService.enqueueDuplication).not.toHaveBeenCalled();
  });

  it("rejects unknown source courses before queueing duplication", async () => {
    const { service, repository, queueService } = createService();

    await expect(service.duplicateCourse(sourceCourse.id, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.createDraftDuplicateCourse).not.toHaveBeenCalled();
    expect(queueService.enqueueDuplication).not.toHaveBeenCalled();
  });

  it("creates a draft duplicate and queues course content copying", async () => {
    const sourceAuthor = { ...actor, userId: sourceCourse.authorId };
    const { service, repository, queueService } = createService(sourceCourse);

    await expect(service.duplicateCourse(sourceCourse.id, sourceAuthor)).resolves.toEqual({
      courseId: "target-course-id",
      jobId: "duplication-job-id",
    });
    expect(repository.createDraftDuplicateCourse).toHaveBeenCalledWith({
      sourceCourse,
      title: { en: "Source course (Copy)" },
      authorId: sourceAuthor.userId,
    });
    expect(queueService.enqueueDuplication).toHaveBeenCalledWith({
      tenantId: sourceAuthor.tenantId,
      sourceCourseId: sourceCourse.id,
      targetCourseId: "target-course-id",
      actor: sourceAuthor,
    });
  });
});
