import { PERMISSIONS, SUPPORTED_LANGUAGES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq, and, isNull } from "drizzle-orm";

import { AnnouncementsService } from "src/announcements/announcements.service";
import { AuthController } from "src/auth/auth.controller";
import { AuthService } from "src/auth/auth.service";
import { CategoryService } from "src/category/category.service";
import { AdminChapterService } from "src/chapter/adminChapter.service";
import { CourseService } from "src/courses/course.service";
import { EnvService } from "src/env/services/env.service";
import { GroupService } from "src/group/group.service";
import { LearningPathService } from "src/learning-path/services/learning-path.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { SettingsService } from "src/settings/settings.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { activityLogs } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { truncateAllTables } from "../../../test/helpers/test-helpers";
import {
  ACTIVITY_LOG_ACTION_TYPES,
  ACTIVITY_LOG_RESOURCE_TYPES,
  type ActivityLogResourceType,
} from "../types";

import type { INestApplication } from "@nestjs/common";
import type { Response } from "express";
import type { CreateChapterBody } from "src/chapter/schemas/chapter.schema";
import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { CreateCourseBody } from "src/courses/schemas/createCourse.schema";
import type { UpdateCourseBody } from "src/courses/schemas/updateCourse.schema";
import type { CreateGroupBody } from "src/group/group.types";
import type { CreateLessonBody, UpdateLessonBody } from "src/lesson/lesson.schema";

describe("Activity Logs E2E", () => {
  let app: INestApplication;

  let adminChapterService: AdminChapterService;
  let announcementsService: AnnouncementsService;
  let adminLessonService: AdminLessonService;
  let settingsService: SettingsService;
  let categoryService: CategoryService;
  let courseService: CourseService;
  let envService: EnvService;
  let groupService: GroupService;
  let learningPathService: LearningPathService;
  let authService: AuthService;
  let authController: AuthController;
  let db: DatabasePg;
  let baseDb: DatabasePg;

  let courseFactory: ReturnType<typeof createCourseFactory>;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let userFactory: ReturnType<typeof createUserFactory>;

  let globalSettingsId: UUIDType;
  let currentAdminUser: CurrentUserType;

  beforeAll(async () => {
    const { app: testAppInstance } = await createE2ETest({ enableActivityLogs: true });
    app = testAppInstance;

    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);

    adminChapterService = app.get(AdminChapterService);
    announcementsService = app.get(AnnouncementsService);
    adminLessonService = app.get(AdminLessonService);
    settingsService = app.get(SettingsService);
    categoryService = app.get(CategoryService);
    courseService = app.get(CourseService);
    envService = app.get(EnvService);
    groupService = app.get(GroupService);
    learningPathService = app.get(LearningPathService);
    authService = app.get(AuthService);
    authController = app.get(AuthController);

    courseFactory = createCourseFactory(db);
    categoryFactory = createCategoryFactory(db);
    userFactory = createUserFactory(db);
  }, 60000);

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(baseDb, db);

    const globalSettings = await db.query.settings.findFirst({
      where: (s, { isNull }) => isNull(s.userId),
    });
    globalSettingsId = globalSettings!.id;

    const adminUser = await userFactory.withAdminRole().create();

    currentAdminUser = {
      userId: adminUser.id,
      email: adminUser.email,
      roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
      permissions: Object.values(PERMISSIONS),
      tenantId: adminUser.tenantId,
    };
  });

  const getLogs = async (
    {
      resourceId,
      resourceType,
    }: {
      resourceId?: UUIDType;
      resourceType?: ActivityLogResourceType | null;
    },
    dbInstance: DatabasePg = db,
  ) => {
    const conditions = [];

    if (resourceId !== undefined) conditions.push(eq(activityLogs.resourceId, resourceId));
    if (resourceType !== undefined) {
      conditions.push(
        resourceType === null
          ? isNull(activityLogs.resourceType)
          : eq(activityLogs.resourceType, resourceType as ActivityLogResourceType),
      );
    }

    if (!conditions.length) return [];

    const [firstCondition, ...rest] = conditions;

    return dbInstance
      .select()
      .from(activityLogs)
      .where(rest.reduce((acc, condition) => and(acc, condition), firstCondition))
      .orderBy(activityLogs.createdAt);
  };

  const waitForLogs = async (
    filters: {
      resourceId?: UUIDType;
      resourceType?: ActivityLogResourceType | null;
    },
    expectedCount = 1,
    timeoutMs = 5000,
  ) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const logs = await getLogs(filters);
      if (logs.length >= expectedCount) return logs;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for activity logs`);
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
      const course = await courseFactory.create({ authorId: currentAdminUser.userId });

      const createBody: CreateChapterBody = {
        courseId: course.id,
        title: "Initial Chapter",
        isFreemium: false,
      };

      const { id: chapterId } = await adminChapterService.createChapterForCourse(
        createBody,
        currentAdminUser,
      );

      return chapterId;
    };

    it("should record CREATE activity log when chapter is created", async () => {
      const chapterId = await createChapter();

      const [createLog] = await waitForLogs({ resourceId: chapterId });
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
        currentAdminUser,
      );

      const logsAfterUpdate = await waitForLogs({ resourceId: chapterId }, 2);
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

      await adminChapterService.removeChapter(chapterId, currentAdminUser);

      const logsAfterDelete = await waitForLogs({ resourceId: chapterId }, 2);
      const deleteLog = logsAfterDelete[logsAfterDelete.length - 1];
      const deleteMetadata = parseMetadata(deleteLog.metadata);

      expect(deleteLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.DELETE);
      expect(deleteLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.CHAPTER);
      expect(deleteMetadata.context?.chapterName).toBe("Initial Chapter");
    });
  });

  describe("Lesson activity logs", () => {
    const createLesson = async () => {
      const course = await courseFactory.create({ authorId: currentAdminUser.userId });

      const { id: chapterId } = await adminChapterService.createChapterForCourse(
        {
          courseId: course.id,
          title: "Lesson Chapter",
          isFreemium: false,
        },
        currentAdminUser,
      );

      const lessonId = await adminLessonService.createLessonForChapter(
        {
          chapterId: chapterId,
          title: "Initial Lesson",
          type: LESSON_TYPES.CONTENT,
          description: "Lesson description",
        } satisfies CreateLessonBody,
        currentAdminUser,
      );

      return lessonId;
    };

    it("should record CREATE activity log when lesson is created", async () => {
      const lessonId = await createLesson();

      const [createLog] = await waitForLogs({ resourceId: lessonId });
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
          type: LESSON_TYPES.CONTENT,
        } satisfies UpdateLessonBody,
        currentAdminUser,
      );

      const logsAfterUpdate = await waitForLogs({ resourceId: lessonId }, 2);
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

      await adminLessonService.removeLesson(lessonId, currentAdminUser);

      const logsAfterDelete = await waitForLogs({ resourceId: lessonId }, 2);
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

      return courseService.createCourse(createBody, currentAdminUser, true);
    };

    it("should record CREATE activity log when course is created", async () => {
      const course = await createCourse();

      const [createLog] = await waitForLogs({ resourceId: course.id });
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

      await courseService.updateCourse(course.id, updateBody, currentAdminUser, true);

      const logsAfterUpdate = await waitForLogs({ resourceId: course.id }, 2);
      const updateLog = logsAfterUpdate[logsAfterUpdate.length - 1];
      const updateMetadata = parseMetadata(updateLog.metadata);
      const changedFields = getChangedFields(updateMetadata);

      expect(updateLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.UPDATE);
      expect(updateLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.COURSE);
      expect(changedFields).toEqual(expect.arrayContaining(["title", "hasCertificate"]));
      expect(updateMetadata.after?.title).toBe("Updated Course");
      expect(updateMetadata.after?.hasCertificate).toBe("true");
    });

    it("should record DELETE activity log when a course is deleted", async () => {
      const course = await createCourse();

      await courseService.deleteCourse(course.id, currentAdminUser);

      const logsAfterDelete = await waitForLogs(
        { resourceId: course.id, resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE },
        2,
      );
      const deleteLog = logsAfterDelete[logsAfterDelete.length - 1];
      const deleteMetadata = parseMetadata(deleteLog.metadata);

      expect(deleteLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.DELETE);
      expect(deleteLog.actorId).toBe(currentAdminUser.userId);
      expect(deleteLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.COURSE);
      expect(deleteMetadata.context?.courseTitle).toBe("Initial Course");
    });

    it("should record one aggregate DELETE activity log for bulk course deletion", async () => {
      const courses = await Promise.all([createCourse(), createCourse()]);

      await courseService.deleteManyCourses(
        courses.map(({ id }) => id),
        currentAdminUser,
      );

      const logs = await waitForLogs(
        { resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE },
        courses.length + 1,
      );
      const deleteLog = logs[logs.length - 1];
      const deleteMetadata = parseMetadata(deleteLog.metadata);

      expect(deleteLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.DELETE);
      expect(deleteLog.actorId).toBe(currentAdminUser.userId);
      expect(deleteLog.resourceId).toBeNull();
      expect(JSON.parse(deleteMetadata.context?.deletedCourseIds).sort()).toEqual(
        courses.map(({ id }) => id).sort(),
      );
      expect(JSON.parse(deleteMetadata.context?.deletedCourseTitles)).toEqual([
        "Initial Course",
        "Initial Course",
      ]);
      expect(deleteMetadata.context?.deletedCount).toBe("2");
    });

    it("should record ENROLL_COURSE activity log when student self-enrolls", async () => {
      const student = await userFactory.withUserSettings(db).create();

      const currentStudentUser: CurrentUserType = {
        userId: student.id,
        email: student.email,
        roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
        permissions: [],
        tenantId: student.tenantId,
      };

      const course = await createCourse();

      await courseService.enrollCourse(
        course.id,
        student.id,
        undefined,
        undefined,
        currentStudentUser,
      );
      const logs = await waitForLogs(
        { resourceId: course.id, resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE },
        2,
      );
      const enrollLog = logs[logs.length - 1];
      const metadata = parseMetadata(enrollLog.metadata);

      expect(enrollLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.ENROLL_COURSE);
      expect(enrollLog.actorId).toBe(student.id);
      expect(enrollLog.resourceId).toBe(course.id);
      expect(metadata.context).toBeNull();
    });

    it("should record ENROLL_COURSE activity log when admin enrolls a student", async () => {
      const student = await userFactory.withUserSettings(db).create();
      const course = await createCourse();

      await courseService.enrollCourses(course.id, { studentIds: [student.id] }, currentAdminUser);

      const logs = await waitForLogs(
        { resourceId: course.id, resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE },
        2,
      );
      const enrollLog = logs[logs.length - 1];
      const metadata = parseMetadata(enrollLog.metadata);

      expect(enrollLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.ENROLL_COURSE);
      expect(enrollLog.actorId).toBe(currentAdminUser.userId);
      expect(enrollLog.resourceId).toBe(course.id);
      expect(metadata.context?.enrolledUserId).toBe(student.id);
    });
  });

  describe("Announcement activity logs", () => {
    it("should record CREATE activity log when announcement is created", async () => {
      const announcement = await announcementsService.createAnnouncement(
        {
          groupId: null,
          baseLanguage: SUPPORTED_LANGUAGES.EN,
          translations: [
            {
              language: SUPPORTED_LANGUAGES.EN,
              title: "Initial Announcement",
              content: "Announcement content",
            },
          ],
        },
        currentAdminUser,
      );

      const [createLog] = await waitForLogs({ resourceId: announcement.id });
      const createMetadata = parseMetadata(createLog.metadata);

      expect(createLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.CREATE);
      expect(createLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.ANNOUNCEMENT);
      expect(createMetadata.after.title).toBe("Initial Announcement");
    });

    it("should record VIEW_ANNOUNCEMENT activity log when announcement is read", async () => {
      const student = await userFactory.create();
      const currentStudentUser: CurrentUserType = {
        userId: student.id,
        email: student.email,
        roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
        permissions: [],
        tenantId: student.tenantId,
      };

      const announcement = await announcementsService.createAnnouncement(
        {
          groupId: null,
          baseLanguage: SUPPORTED_LANGUAGES.EN,
          translations: [
            {
              language: SUPPORTED_LANGUAGES.EN,
              title: "Initial Announcement",
              content: "Announcement content",
            },
          ],
        },
        currentAdminUser,
      );

      await announcementsService.markAnnouncementAsRead(announcement.id, currentStudentUser);

      const logsAfterRead = await waitForLogs({ resourceId: announcement.id }, 2);
      const viewLog = logsAfterRead[logsAfterRead.length - 1];
      const viewMetadata = parseMetadata(viewLog.metadata);

      expect(viewLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.VIEW_ANNOUNCEMENT);
      expect(viewLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.ANNOUNCEMENT);
      expect(viewLog.actorId).toBe(student.id);
      expect(viewLog.resourceId).toBe(announcement.id);
      expect(viewMetadata.context?.audience).toBe("all_users");
    });
  });

  describe("Group activity logs", () => {
    const createGroup = async (body?: Partial<CreateGroupBody>) =>
      groupService.createGroup(
        {
          language: SUPPORTED_LANGUAGES.EN,
          name: "Initial Group",
          characteristic: "Test",
          ...(body ?? {}),
        },
        currentAdminUser,
      );

    it("should record CREATE activity log when group is created", async () => {
      const group = await createGroup();

      const [createLog] = await waitForLogs({ resourceId: group.id });
      const metadata = parseMetadata(createLog.metadata);

      expect(createLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.CREATE);
      expect(createLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.GROUP);
      expect(metadata.after?.name).toBe("Initial Group");
    });

    it("should record UPDATE activity log when group is updated", async () => {
      const group = await createGroup();

      await groupService.updateGroup(group.id, { name: "Updated Group" }, currentAdminUser);

      const logsAfterUpdate = await waitForLogs({ resourceId: group.id }, 2);
      const updateLog = logsAfterUpdate[logsAfterUpdate.length - 1];
      const metadata = parseMetadata(updateLog.metadata);
      const changedFields = getChangedFields(metadata);

      expect(updateLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.UPDATE);
      expect(updateLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.GROUP);
      expect(changedFields).toEqual(expect.arrayContaining(["name"]));
      expect(metadata.after?.name).toBe("Updated Group");
    });

    it("should record DELETE activity log when group is deleted", async () => {
      const group = await createGroup();

      await groupService.deleteGroup(group.id, currentAdminUser);

      const logsAfterDelete = await waitForLogs({ resourceId: group.id }, 2);
      const deleteLog = logsAfterDelete[logsAfterDelete.length - 1];
      const metadata = parseMetadata(deleteLog.metadata);

      expect(deleteLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.DELETE);
      expect(deleteLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.GROUP);
      expect(metadata.context?.groupName).toBe("Initial Group");
    });

    it("should record GROUP_ASSIGNMENT activity log when user assigned to group", async () => {
      const student = await userFactory.create();
      const group = await groupService.createGroup(
        {
          language: SUPPORTED_LANGUAGES.EN,
          name: "Factory Group",
          characteristic: "Test",
        },
        currentAdminUser,
      );

      await groupService.setUserGroups([group.id], student.id, {
        actor: currentAdminUser,
      });

      const logs = await waitForLogs({ resourceId: group.id }, 2);
      const enrollLog = logs[logs.length - 1];
      const metadata = parseMetadata(enrollLog.metadata);

      expect(enrollLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.GROUP_ASSIGNMENT);
      expect(enrollLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.GROUP);
      expect(metadata.context?.userId).toBe(student.id);
    });
  });

  describe("Category activity logs", () => {
    const createCategory = async () =>
      categoryService.createCategory(
        { title: "Initial Category", language: SUPPORTED_LANGUAGES.EN },
        currentAdminUser,
      );

    it("should record CREATE activity log when category is created", async () => {
      const category = await createCategory();

      const [createLog] = await waitForLogs({ resourceId: category.id });
      const createMetadata = parseMetadata(createLog.metadata);

      expect(createLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.CREATE);
      expect(createLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.CATEGORY);
      expect(createMetadata.after?.title).toBe("Initial Category");
    });

    it("should record UPDATE activity log when category is updated", async () => {
      const category = await createCategory();

      await categoryService.updateCategory(
        category.id,
        { title: "Updated Category" },
        currentAdminUser,
      );

      const logsAfterUpdate = await waitForLogs({ resourceId: category.id }, 2);
      const updateLog = logsAfterUpdate[logsAfterUpdate.length - 1];
      const updateMetadata = parseMetadata(updateLog.metadata);
      const changedFields = getChangedFields(updateMetadata);

      expect(updateLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.UPDATE);
      expect(updateLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.CATEGORY);
      expect(changedFields).toEqual(expect.arrayContaining(["title"]));
      expect(updateMetadata.after?.title).toBe("Updated Category");
    });

    it("should record DELETE activity log when category is deleted", async () => {
      const category = await createCategory();

      await categoryService.deleteCategory(category.id, currentAdminUser);

      const logsAfterDelete = await waitForLogs({ resourceId: category.id }, 2);
      const deleteLog = logsAfterDelete[logsAfterDelete.length - 1];
      const deleteMetadata = parseMetadata(deleteLog.metadata);

      expect(deleteLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.DELETE);
      expect(deleteLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.CATEGORY);
      expect(deleteMetadata.context?.categoryName).toBe("Initial Category");
    });
  });

  describe("Settings activity logs", () => {
    it("should record UPDATE activity log when global accessibility is toggled", async () => {
      await settingsService.updateGlobalUnregisteredUserCoursesAccessibility(currentAdminUser);

      const [updateLog] = await waitForLogs({ resourceId: globalSettingsId });
      const updateMetadata = parseMetadata(updateLog.metadata);
      const changedFields = getChangedFields(updateMetadata);

      expect(updateLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.UPDATE);
      expect(updateLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.SETTINGS);
      expect(updateLog.resourceId).toBe(globalSettingsId);
      expect(changedFields).toEqual(
        expect.arrayContaining(["unregisteredUserCoursesAccessibility"]),
      );
    });

    it("should record UPDATE activity log when default course currency changes", async () => {
      await settingsService.updateDefaultCourseCurrency("eur", currentAdminUser);

      const [updateLog] = await waitForLogs({ resourceId: globalSettingsId });
      const updateMetadata = parseMetadata(updateLog.metadata);
      const changedFields = getChangedFields(updateMetadata);

      expect(updateLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.UPDATE);
      expect(updateLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.SETTINGS);
      expect(updateLog.resourceId).toBe(globalSettingsId);
      expect(changedFields).toEqual(expect.arrayContaining(["defaultCourseCurrency"]));
      expect(updateMetadata.after?.defaultCourseCurrency).toBe("eur");
    });
  });

  describe("Env activity logs", () => {
    it("should record UPDATE activity log when env vars are upserted", async () => {
      const envKeys = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];

      await envService.bulkUpsertEnv(
        envKeys.map((key) => ({ name: key, value: "test_value" })),
        currentAdminUser,
      );

      const [log] = await waitForLogs({ resourceType: ACTIVITY_LOG_RESOURCE_TYPES.INTEGRATION });
      const metadata = parseMetadata(log.metadata);
      const changedFields = getChangedFields(metadata);

      expect(log.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.UPDATE);
      expect(log.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.INTEGRATION);
      expect(log.resourceId).toBeNull();
      expect(log.actorId).toBe(currentAdminUser.userId);
      expect(changedFields).toEqual(expect.arrayContaining(envKeys));
    });
  });

  describe("Auth activity logs", () => {
    const createUserWithPassword = async () => {
      const password = "Password123!";

      const user = await userFactory.withCredentials({ password }).withUserSettings(db).create();

      return { user, password };
    };

    it("should record LOGIN activity log when user logs in with password", async () => {
      const { user, password } = await createUserWithPassword();
      const { MFAEnforcedRoles } = await settingsService.getGlobalSettings();

      await authService.login({ email: user.email, password }, MFAEnforcedRoles);

      const [loginLog] = await waitForLogs(
        { resourceId: user.id, resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER },
        1,
      );
      const metadata = parseMetadata(loginLog.metadata);

      expect(loginLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.LOGIN);
      expect(loginLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.USER);
      expect(metadata.context?.method).toBe("password");
    });

    it("should record LOGIN activity log when tokens are refreshed", async () => {
      const { user, password } = await createUserWithPassword();
      const { MFAEnforcedRoles } = await settingsService.getGlobalSettings();

      const { refreshToken } = await authService.login(
        { email: user.email, password },
        MFAEnforcedRoles,
      );

      await authService.refreshTokens(refreshToken);

      const logs = await waitForLogs(
        { resourceId: user.id, resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER },
        2,
      );
      const refreshLog = logs[logs.length - 1];
      const metadata = parseMetadata(refreshLog.metadata);

      expect(refreshLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.LOGIN);
      expect(metadata.context?.method).toBe("refresh_token");
    });

    it("should record LOGOUT activity log when user logs out", async () => {
      const { user } = await createUserWithPassword();

      const currentStudentUser: CurrentUserType = {
        userId: user.id,
        email: user.email,
        roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
        permissions: [],
        tenantId: user.tenantId,
      };

      const responseMock = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      await authController.logout(responseMock, currentStudentUser);

      const [logoutLog] = await waitForLogs(
        { resourceId: currentStudentUser.userId, resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER },
        1,
      );

      expect(logoutLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.LOGOUT);
      expect(logoutLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.USER);
      expect(logoutLog.actorId).toBe(user.id);
    });
  });

  describe("Learning Path activity logs", () => {
    const createLearningPath = async () =>
      learningPathService.createLearningPath(
        {
          title: "Initial Learning Path",
          description: "Learning path description",
          status: "draft",
          language: SUPPORTED_LANGUAGES.EN,
          sequenceEnabled: false,
          includesCertificate: false,
        },
        currentAdminUser,
      );

    it("should record CREATE activity log when learning path is created", async () => {
      const learningPath = await createLearningPath();

      const [createLog] = await waitForLogs({ resourceId: learningPath.id });
      const metadata = parseMetadata(createLog.metadata);

      expect(createLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.CREATE);
      expect(createLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH);
      expect(createLog.resourceId).toBe(learningPath.id);
      expect(metadata.after?.id).toBe(learningPath.id);
    });

    it("should record UPDATE activity log when learning path is updated", async () => {
      const learningPath = await createLearningPath();

      await learningPathService.updateLearningPath(
        learningPath.id,
        {
          title: "Updated Learning Path",
          language: SUPPORTED_LANGUAGES.EN,
        },
        currentAdminUser,
      );

      const logsAfterUpdate = await waitForLogs({ resourceId: learningPath.id }, 2);
      const updateLog = logsAfterUpdate[logsAfterUpdate.length - 1];
      const metadata = parseMetadata(updateLog.metadata);
      const changedFields = getChangedFields(metadata);

      expect(updateLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.UPDATE);
      expect(updateLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH);
      expect(changedFields).toEqual(expect.arrayContaining(["title"]));
    });

    it("should record DELETE activity log when learning path is deleted", async () => {
      const learningPath = await createLearningPath();

      await learningPathService.deleteLearningPath(learningPath.id, currentAdminUser);

      const logsAfterDelete = await waitForLogs({ resourceId: learningPath.id }, 2);
      const deleteLog = logsAfterDelete[logsAfterDelete.length - 1];

      expect(deleteLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.DELETE);
      expect(deleteLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH);
      expect(deleteLog.resourceId).toBe(learningPath.id);
    });

    it("should record ENROLL_LEARNING_PATH activity log when admin enrolls a student", async () => {
      const student = await userFactory.withUserSettings(db).create();
      const learningPath = await createLearningPath();

      await learningPathService.enrollUsersToLearningPath(
        learningPath.id,
        { studentIds: [student.id] },
        currentAdminUser,
      );

      const logsAfterEnroll = await waitForLogs({ resourceId: learningPath.id }, 2);
      const enrollLog = logsAfterEnroll[logsAfterEnroll.length - 1];
      const metadata = parseMetadata(enrollLog.metadata);

      expect(enrollLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.ENROLL_LEARNING_PATH);
      expect(enrollLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH);
      expect(enrollLog.resourceId).toBe(learningPath.id);
      expect(metadata.context?.enrolledUserIds).toBe(JSON.stringify([student.id]));
      expect(metadata.context?.enrolledCount).toBe("1");
    });

    it("should record ENROLL_LEARNING_PATH when student self-enrolls", async () => {
      const publishedLearningPath = await learningPathService.createLearningPath(
        {
          title: "Published Learning Path",
          description: "Published",
          status: "published",
          language: SUPPORTED_LANGUAGES.EN,
          sequenceEnabled: false,
          includesCertificate: false,
        },
        currentAdminUser,
      );

      const student = await userFactory.withUserSettings(db).create();
      const currentStudentUser: CurrentUserType = {
        userId: student.id,
        email: student.email,
        roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
        permissions: Object.values(PERMISSIONS),
        tenantId: student.tenantId,
      };

      await learningPathService.enrollCurrentUserToLearningPath(
        publishedLearningPath.id,
        currentStudentUser,
      );

      const logsAfterEnroll = await waitForLogs({ resourceId: publishedLearningPath.id }, 2);
      const enrollLog = logsAfterEnroll[logsAfterEnroll.length - 1];
      const metadata = parseMetadata(enrollLog.metadata);

      expect(enrollLog.actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.ENROLL_LEARNING_PATH);
      expect(enrollLog.resourceType).toBe(ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH);
      expect(enrollLog.actorId).toBe(student.id);
      expect(metadata.context?.enrolledUserIds).toBe(JSON.stringify([student.id]));
      expect(metadata.context?.enrolledCount).toBe("1");
    });
  });

  describe("SCORM activity logs", () => {
    it("should record CREATE activity log when SCORM course is created without import", async () => {
      const category = await categoryFactory.create();

      const course = await courseService.createCourse(
        {
          title: "SCORM Course",
          description: "SCORM course description",
          status: "draft",
          categoryId: category.id,
          language: SUPPORTED_LANGUAGES.EN,
          hasCertificate: false,
          isScorm: true,
        },
        currentAdminUser,
        true,
      );

      const logs = await waitForLogs({
        resourceId: course.id,
        resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE,
      });

      expect(logs[0].actionType).toBe(ACTIVITY_LOG_ACTION_TYPES.CREATE);
      expect(logs[0].resourceId).toBe(course.id);
    });
  });
});
