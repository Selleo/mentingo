import { USER_ROLES } from "src/user/schemas/userRoles";
import { createUnitTest, type TestContext } from "test/create-unit-test";
import { createCourseFactory } from "test/factory/course.factory";
import { createUserFactory } from "test/factory/user.factory";
import { truncateAllTables } from "test/helpers/test-helpers";

import { CourseService } from "../course.service";
import { QUIZ_FEEDBACK_ENABLED, LESSON_SEQUENCE_ENABLED } from "../constants";

import type { DatabasePg } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

describe("CourseService", () => {
  let testContext: TestContext;
  let courseService: CourseService;
  let db: DatabasePg;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let userFactory: ReturnType<typeof createUserFactory>;

  beforeAll(async () => {
    testContext = await createUnitTest();
    courseService = testContext.module.get(CourseService);
    db = testContext.db;
    courseFactory = createCourseFactory(db);
    userFactory = createUserFactory(db);
  }, 30000);

  afterEach(async () => {
    await truncateAllTables(db);
  });

  afterAll(async () => {
    await testContext.teardown();
  });

  describe("updateCourseSettings", () => {
    it("should update quizFeedbackEnabled flag to false", async () => {
      const course = await courseFactory.create();
      const user = await userFactory.withAdminRole().create();

      const currentUser: CurrentUser = {
        userId: user.id,
        email: user.email,
        role: USER_ROLES.ADMIN,
      };

      const updatedCourse = await courseService.updateCourseSettings(
        course.id,
        { quizFeedbackEnabled: false },
        currentUser,
      );

      expect(updatedCourse.settings.quizFeedbackEnabled).toBe(false);
      expect(updatedCourse.settings.lessonSequenceEnabled).toBe(LESSON_SEQUENCE_ENABLED);
    });

    it("should update quizFeedbackEnabled flag to true", async () => {
      const course = await courseFactory.create({
        settings: {
          lessonSequenceEnabled: LESSON_SEQUENCE_ENABLED,
          quizFeedbackEnabled: false,
        },
      });
      const user = await userFactory.withAdminRole().create();

      const currentUser: CurrentUser = {
        userId: user.id,
        email: user.email,
        role: USER_ROLES.ADMIN,
      };

      const updatedCourse = await courseService.updateCourseSettings(
        course.id,
        { quizFeedbackEnabled: true },
        currentUser,
      );

      expect(updatedCourse.settings.quizFeedbackEnabled).toBe(true);
      expect(updatedCourse.settings.lessonSequenceEnabled).toBe(LESSON_SEQUENCE_ENABLED);
    });

    it("should update both quizFeedbackEnabled and lessonSequenceEnabled flags", async () => {
      const course = await courseFactory.create();
      const user = await userFactory.withAdminRole().create();

      const currentUser: CurrentUser = {
        userId: user.id,
        email: user.email,
        role: USER_ROLES.ADMIN,
      };

      const updatedCourse = await courseService.updateCourseSettings(
        course.id,
        {
          quizFeedbackEnabled: false,
          lessonSequenceEnabled: true,
        },
        currentUser,
      );

      expect(updatedCourse.settings.quizFeedbackEnabled).toBe(false);
      expect(updatedCourse.settings.lessonSequenceEnabled).toBe(true);
    });

    it("should preserve existing settings when updating only one flag", async () => {
      const course = await courseFactory.create({
        settings: {
          lessonSequenceEnabled: true,
          quizFeedbackEnabled: true,
        },
      });
      const user = await userFactory.withAdminRole().create();

      const currentUser: CurrentUser = {
        userId: user.id,
        email: user.email,
        role: USER_ROLES.ADMIN,
      };

      const updatedCourse = await courseService.updateCourseSettings(
        course.id,
        { quizFeedbackEnabled: false },
        currentUser,
      );

      expect(updatedCourse.settings.quizFeedbackEnabled).toBe(false);
      expect(updatedCourse.settings.lessonSequenceEnabled).toBe(true);
    });
  });

  describe("getCourseSettings", () => {
    it("should return course settings with default quizFeedbackEnabled value", async () => {
      const course = await courseFactory.create();

      const settings = await courseService.getCourseSettings(course.id);

      expect(settings.quizFeedbackEnabled).toBe(QUIZ_FEEDBACK_ENABLED);
      expect(settings.lessonSequenceEnabled).toBe(LESSON_SEQUENCE_ENABLED);
    });

    it("should return course settings with custom quizFeedbackEnabled value", async () => {
      const course = await courseFactory.create({
        settings: {
          lessonSequenceEnabled: LESSON_SEQUENCE_ENABLED,
          quizFeedbackEnabled: false,
        },
      });

      const settings = await courseService.getCourseSettings(course.id);

      expect(settings.quizFeedbackEnabled).toBe(false);
      expect(settings.lessonSequenceEnabled).toBe(LESSON_SEQUENCE_ENABLED);
    });

    it("should return course settings with both flags set", async () => {
      const course = await courseFactory.create({
        settings: {
          lessonSequenceEnabled: true,
          quizFeedbackEnabled: false,
        },
      });

      const settings = await courseService.getCourseSettings(course.id);

      expect(settings.quizFeedbackEnabled).toBe(false);
      expect(settings.lessonSequenceEnabled).toBe(true);
    });
  });

  describe("course settings type safety", () => {
    it("should enforce correct type for quizFeedbackEnabled in settings", async () => {
      const course = await courseFactory.create({
        settings: {
          lessonSequenceEnabled: LESSON_SEQUENCE_ENABLED,
          quizFeedbackEnabled: true,
        },
      });

      const settings = await courseService.getCourseSettings(course.id);

      expect(typeof settings.quizFeedbackEnabled).toBe("boolean");
      expect(typeof settings.lessonSequenceEnabled).toBe("boolean");
    });

    it("should maintain type safety when updating settings", async () => {
      const course = await courseFactory.create();
      const user = await userFactory.withAdminRole().create();

      const currentUser: CurrentUser = {
        userId: user.id,
        email: user.email,
        role: USER_ROLES.ADMIN,
      };

      const updatedCourse = await courseService.updateCourseSettings(
        course.id,
        { quizFeedbackEnabled: false },
        currentUser,
      );

      expect(typeof updatedCourse.settings.quizFeedbackEnabled).toBe("boolean");
      expect(updatedCourse.settings.quizFeedbackEnabled).toBe(false);
    });
  });
});
