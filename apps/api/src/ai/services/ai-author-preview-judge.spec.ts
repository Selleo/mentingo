import { PERMISSIONS, SUPPORTED_LANGUAGES } from "@repo/shared";

import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";

import { AiService } from "./ai.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

jest.mock("@langfuse/tracing", () => ({
  observe: (fn: () => unknown) => fn,
  propagateAttributes: (_attributes: unknown, fn: () => unknown) => fn(),
  updateActiveObservation: jest.fn(),
}));

describe("author preview Check", () => {
  it.each([
    { status: "published", enrolled: false },
    { status: "published", enrolled: true },
    { status: "draft", enrolled: false },
    { status: "draft", enrolled: true },
  ])(
    "returns feedback without updating progress for $status / enrolled=$enrolled",
    async ({ status, enrolled }) => {
      const permissions = [
        PERMISSIONS.AI_USE,
        PERMISSIONS.COURSE_UPDATE_OWN,
        PERMISSIONS.LEARNING_MODE_USE,
        PERMISSIONS.LEARNING_PROGRESS_UPDATE,
      ];
      const user = { userId: "author", tenantId: "tenant", permissions } as CurrentUserType;
      const progressDb = { insert: jest.fn(), update: jest.fn(), transaction: jest.fn() };
      const outboxPublisher = { publish: jest.fn() };
      const progress = new StudentLessonProgressService(
        progressDb as never,
        {} as never,
        {} as never,
        outboxPublisher as never,
        {} as never,
        {} as never,
      );
      // Stub persistence reads and inactive Learn mode; keep the progress permission guard real.
      Object.assign(progress, {
        checkLessonAssignment: jest.fn().mockResolvedValue([
          {
            courseStatus: status,
            isCourseAuthor: true,
            isAssigned: enrolled,
            isFreemium: false,
            isPublicCoursePreview: status === "published" && !enrolled,
          },
        ]),
        resolveLearningModeStatusByPermissions: jest.fn().mockResolvedValue(false),
      });
      const markCompleted = jest.spyOn(progress, "markLessonAsCompleted");
      const result = {
        passed: true,
        score: 1,
        maxScore: 1,
        percentage: 100,
        criteria: [],
        blockingErrors: [],
      };
      const rubric = { configurationId: "judge" };
      const judgeService = {
        evaluate: jest.fn().mockResolvedValue({ data: result, rubric }),
        persistJudgement: jest.fn(),
      };
      const service = Object.assign(Object.create(AiService.prototype), {
        aiRepository: {
          findThread: jest.fn().mockResolvedValue({
            id: "thread",
            userId: user.userId,
            userLanguage: SUPPORTED_LANGUAGES.EN,
            learningStateId: "learning-state",
          }),
          findLessonIdByThreadId: jest
            .fn()
            .mockResolvedValue({ lessonId: "lesson", courseId: "course" }),
        },
        judgeService,
        permissionsService: { getUserAccess: jest.fn().mockResolvedValue({ permissions }) },
        courseRepetitionService: {
          lock: jest.fn(),
          resolveWritableState: jest.fn().mockResolvedValue("learning-state"),
        },
        studentLessonProgressService: progress,
        db: { transaction: (run: (tx: unknown) => Promise<unknown>) => run({}) },
      }) as AiService;

      await expect(
        service.runJudge({ threadId: "thread", userId: user.userId }, user),
      ).resolves.toEqual({ data: result });
      expect(judgeService.evaluate).toHaveBeenCalledWith(
        { threadId: "thread", userId: user.userId },
        expect.objectContaining({ userId: user.userId }),
      );
      expect(judgeService.persistJudgement).toHaveBeenCalledWith(
        "thread",
        SUPPORTED_LANGUAGES.EN,
        rubric,
        result,
      );
      expect(markCompleted).toHaveBeenCalledTimes(1);
      await expect(markCompleted.mock.results[0]?.value).resolves.toEqual({ messageKey: null });
      expect(progressDb.insert).not.toHaveBeenCalled();
      expect(progressDb.update).not.toHaveBeenCalled();
      expect(progressDb.transaction).not.toHaveBeenCalled();
      expect(outboxPublisher.publish).not.toHaveBeenCalled();
    },
  );
});
