import { LearningTimeRepository } from "src/learning-time/learning-time.repository";
import { QueueService } from "src/queue";

import { createUnitTest } from "../../../test/create-unit-test";
import { createLearningTimeTestSetup } from "../../../test/factory/learning-time.factory";
import { truncateTables } from "../../../test/helpers/test-helpers";

import type { TestContext } from "../../../test/create-unit-test";
import type { DatabasePg } from "src/common";
import type { LearningTimeJobData } from "src/queue/queue.types";

describe("LearningTimeWorker (integration with real Redis)", () => {
  let testContext: TestContext;
  let db: DatabasePg;
  let repository: LearningTimeRepository;
  let queueService: QueueService;

  beforeAll(async () => {
    testContext = await createUnitTest();
    repository = testContext.module.get(LearningTimeRepository);
    queueService = testContext.module.get(QueueService);
    db = testContext.db;
  }, 60000); // Extended timeout for Redis + Postgres containers

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

  describe("job processing via real BullMQ queue", () => {
    it("should process learning time job and update database", async () => {
      const { userId, lessonId, courseId } = await createLearningTimeTestSetup(db);

      const jobData: LearningTimeJobData = {
        userId,
        lessonId,
        courseId,
        secondsToAdd: 60,
        timestamp: Date.now(),
      };

      const job = await queueService.enqueue("learning-time", "update-learning-time", jobData);

      const events = queueService.getQueueEvents("learning-time");
      await events.waitUntilReady();
      await job.waitUntilFinished(events, 10000);

      const result = await repository.getLearningTimeForUser(userId, lessonId);
      expect(result).toBe(60);
    });

    it("should accumulate learning time from multiple jobs", async () => {
      const { userId, lessonId, courseId } = await createLearningTimeTestSetup(db);

      const jobs = await Promise.all([
        queueService.enqueue("learning-time", "update-learning-time", {
          userId,
          lessonId,
          courseId,
          secondsToAdd: 30,
          timestamp: Date.now(),
        } as LearningTimeJobData),
        queueService.enqueue("learning-time", "update-learning-time", {
          userId,
          lessonId,
          courseId,
          secondsToAdd: 40,
          timestamp: Date.now() + 1,
        } as LearningTimeJobData),
      ]);

      await queueService.waitForJobsCompletion("learning-time", jobs);

      const result = await repository.getLearningTimeForUser(userId, lessonId);
      expect(result).toBe(70); // 30 + 40 seconds from both jobs
    });

    it("should handle jobs for different users in parallel", async () => {
      const setup1 = await createLearningTimeTestSetup(db);
      const setup2 = await createLearningTimeTestSetup(db);

      const jobs = await Promise.all([
        queueService.enqueue("learning-time", "update-learning-time", {
          userId: setup1.userId,
          lessonId: setup1.lessonId,
          courseId: setup1.courseId,
          secondsToAdd: 100,
          timestamp: Date.now(),
        } as LearningTimeJobData),
        queueService.enqueue("learning-time", "update-learning-time", {
          userId: setup2.userId,
          lessonId: setup2.lessonId,
          courseId: setup2.courseId,
          secondsToAdd: 200,
          timestamp: Date.now(),
        } as LearningTimeJobData),
      ]);

      await queueService.waitForJobsCompletion("learning-time", jobs);

      const time1 = await repository.getLearningTimeForUser(setup1.userId, setup1.lessonId);
      const time2 = await repository.getLearningTimeForUser(setup2.userId, setup2.lessonId);

      expect(time1).toBe(100);
      expect(time2).toBe(200);
    });
  });
});
