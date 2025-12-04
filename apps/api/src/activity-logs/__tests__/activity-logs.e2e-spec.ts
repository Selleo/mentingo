import { eq } from "drizzle-orm";

import { AnnouncementsService } from "src/announcements/announcements.service";
import { AdminChapterService } from "src/chapter/adminChapter.service";
import { CourseService } from "src/courses/course.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { activityLogs } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { truncateAllTables } from "../../../test/helpers/test-helpers";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";

import type { INestApplication } from "@nestjs/common";
import type { CreateChapterBody } from "src/chapter/schemas/chapter.schema";
import type { DatabasePg, UUIDType } from "src/common";
import type { CreateCourseBody } from "src/courses/schemas/createCourse.schema";
import type { UpdateCourseBody } from "src/courses/schemas/updateCourse.schema";
import type { CreateLessonBody, UpdateLessonBody } from "src/lesson/lesson.schema";

describe("Activity Logs E2E", () => {
  let app: INestApplication;

  let adminChapterService: AdminChapterService;
  let announcementsService: AnnouncementsService;
  let adminLessonService: AdminLessonService;
  let courseService: CourseService;
  let db: DatabasePg;

  let courseFactory: ReturnType<typeof createCourseFactory>;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let userFactory: ReturnType<typeof createUserFactory>;

  let adminUserId: UUIDType;

  beforeAll(async () => {
    const { app: testAppInstance } = await createE2ETest();
    app = testAppInstance;

    db = app.get("DB");
    adminChapterService = app.get(AdminChapterService);
    announcementsService = app.get(AnnouncementsService);
    adminLessonService = app.get(AdminLessonService);
    courseService = app.get(CourseService);

    courseFactory = createCourseFactory(db);
    categoryFactory = createCategoryFactory(db);
    settingsFactory = createSettingsFactory(db);
    userFactory = createUserFactory(db);
  }, 60000);

  afterAll(async () => {
    await truncateAllTables(db);
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(db);

    await settingsFactory.create();

    const adminUser = await userFactory.withAdminRole().create();
    adminUserId = adminUser.id;
  });

  const getLogsForResource = async (resourceId: UUIDType) =>
    db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.resourceId, resourceId))
      .orderBy(activityLogs.createdAt);

  const waitForLogs = async (resourceId: UUIDType, expectedCount = 1, timeoutMs = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const logs = await getLogsForResource(resourceId);
      if (logs.length >= expectedCount) return logs;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for activity logs for resource ${resourceId}`);
  };

  const parseMetadata = (metadata: any) =>
    typeof metadata === "string" ? JSON.parse(metadata) : metadata;

  const getChangedFields = (metadata: any): string[] => {
    if (Array.isArray(metadata?.changedFields)) return metadata.changedFields as string[];

    if (typeof metadata?.changedFields === "string") {
      try {
        return JSON.parse(metadata.changedFields);
      } catch {
        return [];
      }
    }

    return [];
  };

  describe("Chapter activity logs", () => {
    const createChapter = async () => {
      const course = await courseFactory.create({ authorId: adminUserId });

      const createBody: CreateChapterBody = {
        courseId: course.id,
        title: "Initial Chapter",
        isFreemium: false,
      };

      const { id: chapterId } = await adminChapterService.createChapterForCourse(
        createBody,
        adminUserId,
        USER_ROLES.ADMIN,
      );

      return chapterId;
    };

    it("should record CREATE activity log when chapter is created", async () => {
      const chapterId = await createChapter();

      const [createLog] = await waitForLogs(chapterId);
      const createMetadata = parseMetadata(createLog.metadata);

      expect(createLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.CREATE);
      expect(createLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.CHAPTER);
      expect(createMetadata.after?.title).toBe("Initial Chapter");
    });

    it("should record UPDATE activity log when chapter is updated", async () => {
      const chapterId = await createChapter();

      await adminChapterService.updateChapter(
        chapterId,
        {
          title: "Updated Chapter",
          language: "en",
          isFreemium: true,
        },
        adminUserId,
        USER_ROLES.ADMIN,
      );

      const logsAfterUpdate = await waitForLogs(chapterId, 2);
      const updateLog = logsAfterUpdate[logsAfterUpdate.length - 1];
      const updateMetadata = parseMetadata(updateLog.metadata);
      const changedFields = getChangedFields(updateMetadata);

      expect(updateLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.UPDATE);
      expect(updateLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.CHAPTER);
      expect(changedFields).toEqual(expect.arrayContaining(["title", "isFreemium"]));
      expect(updateMetadata.after?.title).toBe("Updated Chapter");
      expect(updateMetadata.after?.isFreemium).toBe("true");
    });

    it("should record DELETE activity log when chapter is deleted", async () => {
      const chapterId = await createChapter();

      await adminChapterService.removeChapter(chapterId, adminUserId, USER_ROLES.ADMIN);

      const logsAfterDelete = await waitForLogs(chapterId, 2);
      const deleteLog = logsAfterDelete[logsAfterDelete.length - 1];
      const deleteMetadata = parseMetadata(deleteLog.metadata);

      expect(deleteLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.DELETE);
      expect(deleteLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.CHAPTER);
      expect(deleteMetadata.context?.chapterName).toBe("Initial Chapter");
    });
  });

  describe("Lesson activity logs", () => {
    const createLesson = async () => {
      const course = await courseFactory.create({ authorId: adminUserId });

      const { id: chapterId } = await adminChapterService.createChapterForCourse(
        {
          courseId: course.id,
          title: "Lesson Chapter",
          isFreemium: false,
        },
        adminUserId,
        USER_ROLES.ADMIN,
      );

      const lessonId = await adminLessonService.createLessonForChapter(
        {
          chapterId: chapterId,
          title: "Initial Lesson",
          type: LESSON_TYPES.TEXT,
          description: "Lesson description",
        } satisfies CreateLessonBody,
        adminUserId,
        USER_ROLES.ADMIN,
      );

      return lessonId;
    };

    it("should record CREATE activity log when lesson is created", async () => {
      const lessonId = await createLesson();

      const [createLog] = await waitForLogs(lessonId);
      const createMetadata = parseMetadata(createLog.metadata);

      expect(createLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.CREATE);
      expect(createLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.LESSON);
      expect(createMetadata.after?.title).toBe("Initial Lesson");
    });

    it("should record UPDATE activity log when lesson is updated", async () => {
      const lessonId = await createLesson();

      await adminLessonService.updateLesson(
        lessonId,
        {
          language: "en",
          title: "Updated Lesson",
          description: "Updated description",
          type: LESSON_TYPES.TEXT,
        } satisfies UpdateLessonBody,
        adminUserId,
        USER_ROLES.ADMIN,
      );

      const logsAfterUpdate = await waitForLogs(lessonId, 2);
      const updateLog = logsAfterUpdate[logsAfterUpdate.length - 1];
      const updateMetadata = parseMetadata(updateLog.metadata);
      const changedFields = getChangedFields(updateMetadata);

      expect(updateLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.UPDATE);
      expect(updateLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.LESSON);
      expect(changedFields).toEqual(expect.arrayContaining(["title", "description"]));
      expect(updateMetadata.after?.title).toBe("Updated Lesson");
    });

    it("should record DELETE activity log when lesson is deleted", async () => {
      const lessonId = await createLesson();

      await adminLessonService.removeLesson(lessonId, adminUserId, USER_ROLES.ADMIN);

      const logsAfterDelete = await waitForLogs(lessonId, 2);
      const deleteLog = logsAfterDelete[logsAfterDelete.length - 1];
      const deleteMetadata = parseMetadata(deleteLog.metadata);

      expect(deleteLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.DELETE);
      expect(deleteLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.LESSON);
      expect(deleteMetadata.context?.lessonName).toBe("Initial Lesson");
    });
  });

  describe("Course activity logs", () => {
    const createCourse = async () => {
      const category = await categoryFactory.create();

      const createBody: CreateCourseBody = {
        title: "Initial Course",
        description: "Course description",
        status: "draft",
        categoryId: category.id,
        language: "en",
        hasCertificate: false,
      };

      return courseService.createCourse(createBody, adminUserId, true);
    };

    it("should record CREATE activity log when course is created", async () => {
      const course = await createCourse();

      const [createLog] = await waitForLogs(course.id);
      const createMetadata = parseMetadata(createLog.metadata);

      expect(createLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.CREATE);
      expect(createLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.COURSE);
      expect(createMetadata.after?.title).toBe("Initial Course");
    });

    it("should record UPDATE activity log when course is updated", async () => {
      const course = await createCourse();

      const updateBody = {
        title: "Updated Course",
        hasCertificate: true,
        language: "en",
      } satisfies UpdateCourseBody & { hasCertificate: boolean };

      await courseService.updateCourse(course.id, updateBody, adminUserId, USER_ROLES.ADMIN, true);

      const logsAfterUpdate = await waitForLogs(course.id, 2);
      const updateLog = logsAfterUpdate[logsAfterUpdate.length - 1];
      const updateMetadata = parseMetadata(updateLog.metadata);
      const changedFields = getChangedFields(updateMetadata);

      expect(updateLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.UPDATE);
      expect(updateLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.COURSE);
      expect(changedFields).toEqual(expect.arrayContaining(["title", "hasCertificate"]));
      expect(updateMetadata.after?.title).toBe("Updated Course");
      expect(updateMetadata.after?.hasCertificate).toBe("true");
    });
  });

  describe("Announcement activity logs", () => {
    it("should record CREATE activity log when announcement is created", async () => {
      const announcement = await announcementsService.createAnnouncement(
        {
          title: "Initial Announcement",
          content: "Announcement content",
          groupId: null,
        },
        adminUserId,
      );

      const [createLog] = await waitForLogs(announcement.id);
      const createMetadata = parseMetadata(createLog.metadata);

      expect(createLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.CREATE);
      expect(createLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.ANNOUNCEMENT);
      expect(createMetadata.after.title).toBe("Initial Announcement");
    });

    it("should record VIEW_ANNOUNCEMENT activity log when announcement is read", async () => {
      const student = await userFactory.create();

      const announcement = await announcementsService.createAnnouncement(
        {
          title: "Initial Announcement",
          content: "Announcement content",
          groupId: null,
        },
        adminUserId,
      );

      await announcementsService.markAnnouncementAsRead(announcement.id, student.id);

      const logsAfterRead = await waitForLogs(announcement.id, 2);
      const viewLog = logsAfterRead[logsAfterRead.length - 1];
      const viewMetadata = parseMetadata(viewLog.metadata);

      expect(viewLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.VIEW_ANNOUNCEMENT);
      expect(viewLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.ANNOUNCEMENT);
      expect(viewLog.actorId).toBe(student.id);
      expect(viewLog.resourceId).toBe(announcement.id);
      expect(viewMetadata.context?.audience).toBe("everyone");
    });
  });
});
