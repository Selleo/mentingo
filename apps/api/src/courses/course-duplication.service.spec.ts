import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { COURSE_TYPE, PERMISSIONS } from "@repo/shared";

import { CourseDuplicationService } from "src/courses/course-duplication.service";

import type { DatabasePg } from "src/common";
import type { CourseDuplicationQueueService } from "src/courses/course-duplication.queue.service";
import type { MasterCourseService } from "src/courses/master-course.service";
import type { SearchIndexService } from "src/global-search/search-index.service";
import type { WsGateway } from "src/websocket";

const createDbMock = (courseRows: unknown[]) => {
  const limit = jest.fn().mockResolvedValue(courseRows);
  const where = jest.fn(() => ({ limit }));
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));

  return {
    db: { select } as unknown as DatabasePg,
    select,
    from,
    where,
    limit,
  };
};

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
  };

  const actor = {
    userId: "other-user-id",
    email: "other@example.com",
    roleSlugs: [],
    permissions: [PERMISSIONS.COURSE_CREATE, PERMISSIONS.COURSE_UPDATE_OWN],
    tenantId: "tenant-id",
  };

  const createService = (db: DatabasePg) => {
    const queueService = {
      enqueueDuplication: jest.fn(),
      getJobStatus: jest.fn(),
    } as unknown as jest.Mocked<CourseDuplicationQueueService>;

    const service = new CourseDuplicationService(
      db,
      queueService,
      {} as MasterCourseService,
      {} as SearchIndexService,
      {} as WsGateway,
    );

    return { service, queueService };
  };

  it("rejects users without manage access to the source course", async () => {
    const { db } = createDbMock([sourceCourse]);
    const { service, queueService } = createService(db);

    await expect(service.duplicateCourse(sourceCourse.id, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(queueService.enqueueDuplication).not.toHaveBeenCalled();
  });

  it("rejects unknown source courses before queueing duplication", async () => {
    const { db } = createDbMock([]);
    const { service, queueService } = createService(db);

    await expect(service.duplicateCourse(sourceCourse.id, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(queueService.enqueueDuplication).not.toHaveBeenCalled();
  });
});
