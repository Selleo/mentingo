import { LearningTimeRepository } from "src/learning-time/learning-time.repository";

import { createUnitTest } from "../../../test/create-unit-test";
import {
  createLearningTimeFactory,
  createLearningTimeTestSetup,
} from "../../../test/factory/learning-time.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { truncateTables } from "../../../test/helpers/test-helpers";

import type { TestContext } from "../../../test/create-unit-test";
import type { DatabasePg } from "src/common";

describe("LearningTimeRepository", () => {
  let testContext: TestContext;
  let db: DatabasePg;
  let repository: LearningTimeRepository;
  let learningTimeFactory: ReturnType<typeof createLearningTimeFactory>;
  let userFactory: ReturnType<typeof createUserFactory>;

  beforeAll(async () => {
    testContext = await createUnitTest();
    repository = testContext.module.get(LearningTimeRepository);
    db = testContext.db;

    learningTimeFactory = createLearningTimeFactory(db);
    userFactory = createUserFactory(db);
  }, 30000);

  afterAll(async () => {
    await truncateTables(db, [
      "lesson_learning_time",
      "lessons",
      "chapters",
      "courses",
      "categories",
      "users",
    ]);
    await testContext.teardown();
  });

  describe("addLearningTime", () => {
    it("should create new record when none exists", async () => {
      const { userId, lessonId, courseId } = await createLearningTimeTestSetup(db);

      await repository.addLearningTime(userId, lessonId, courseId, 60);

      const result = await repository.getLearningTimeForUser(userId, lessonId);
      expect(result).toBe(60);
    });

    it("should increment existing record", async () => {
      const { userId, lessonId, courseId } = await createLearningTimeTestSetup(db);

      await repository.addLearningTime(userId, lessonId, courseId, 30);
      await repository.addLearningTime(userId, lessonId, courseId, 45);

      const result = await repository.getLearningTimeForUser(userId, lessonId);
      expect(result).toBe(75);
    });

    it("should handle multiple users on same lesson", async () => {
      const { lessonId, courseId } = await createLearningTimeTestSetup(db);
      const user1 = await userFactory.create();
      const user2 = await userFactory.create();

      await repository.addLearningTime(user1.id, lessonId, courseId, 100);
      await repository.addLearningTime(user2.id, lessonId, courseId, 200);

      const result1 = await repository.getLearningTimeForUser(user1.id, lessonId);
      const result2 = await repository.getLearningTimeForUser(user2.id, lessonId);

      expect(result1).toBe(100);
      expect(result2).toBe(200);
    });
  });

  describe("getLearningTimeForUser", () => {
    it("should return 0 when no record exists", async () => {
      const { userId, lessonId } = await createLearningTimeTestSetup(db);

      const result = await repository.getLearningTimeForUser(userId, lessonId);
      expect(result).toBe(0);
    });
  });

  describe("getLearningTimeForCourse", () => {
    it("should return all learning time records for a course", async () => {
      const learningTime = await learningTimeFactory.create({
        totalSeconds: 300,
      });

      const results = await repository.getLearningTimeForCourse(learningTime.courseId);

      expect(results.length).toBeGreaterThanOrEqual(1);
      const record = results.find((r) => r.lessonId === learningTime.lessonId);
      expect(record).toBeDefined();
      expect(record?.totalSeconds).toBe(300);
    });

    it("should include user and lesson details", async () => {
      const learningTime = await learningTimeFactory.create();

      const results = await repository.getLearningTimeForCourse(learningTime.courseId);

      const record = results.find((r) => r.lessonId === learningTime.lessonId);
      expect(record?.userEmail).toBeDefined();
      expect(record?.lessonTitle).toBeDefined();
    });
  });

  describe("getAverageLearningTimePerLesson", () => {
    it("should calculate average time per lesson", async () => {
      const { lessonId, courseId } = await createLearningTimeTestSetup(db);
      const user1 = await userFactory.create();
      const user2 = await userFactory.create();

      await repository.addLearningTime(user1.id, lessonId, courseId, 100);
      await repository.addLearningTime(user2.id, lessonId, courseId, 200);

      const results = await repository.getAverageLearningTimePerLesson(courseId);

      const record = results.find((r) => r.lessonId === lessonId);
      expect(record).toBeDefined();
      expect(record?.averageSeconds).toBe(150); // (100 + 200) / 2
      expect(record?.totalUsers).toBe(2);
      expect(record?.totalSeconds).toBe(300);
    });
  });

  describe("getTotalLearningTimePerStudent", () => {
    it("should calculate total time per student", async () => {
      const learningTime = await learningTimeFactory.create({
        totalSeconds: 500,
      });

      const results = await repository.getTotalLearningTimePerStudent(learningTime.courseId);

      const record = results.find((r) => r.id === learningTime.userId);
      expect(record).toBeDefined();
      expect(record?.totalSeconds).toBe(500);
      expect(record?.groups).toBeNull();
    });
  });

  describe("getCourseTotalLearningTime", () => {
    it("should return average learning time for course", async () => {
      const { courseId, lessonId } = await createLearningTimeTestSetup(db);
      const user1 = await userFactory.create();
      const user2 = await userFactory.create();

      await repository.addLearningTime(user1.id, lessonId, courseId, 100);
      await repository.addLearningTime(user2.id, lessonId, courseId, 200);

      const result = await repository.getCourseTotalLearningTime(courseId);

      expect(result.averageSeconds).toBe(150);
      expect(result.uniqueUsers).toBe(2);
    });

    it("should return zeros for course with no learning time", async () => {
      const { courseId } = await createLearningTimeTestSetup(db);

      const result = await repository.getCourseTotalLearningTime(courseId);

      expect(result.averageSeconds).toBe(0);
      expect(result.uniqueUsers).toBe(0);
    });
  });
});
