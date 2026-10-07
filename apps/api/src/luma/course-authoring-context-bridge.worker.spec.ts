jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn(), close: jest.fn() })),
  UnrecoverableError: class UnrecoverableError extends Error {},
}));

import { ForbiddenException } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";

import { CourseAuthoringContextBridgeWorker } from "./course-authoring-context-bridge.worker";

describe("CourseAuthoringContextBridgeWorker", () => {
  const tenantId = "00000000-0000-4000-8000-000000000001";
  const courseId = "00000000-0000-4000-8000-000000000002";
  const sessionId = "00000000-0000-4000-8000-000000000003";
  const contextRequestId = "00000000-0000-4000-8000-000000000004";
  const requestId = "00000000-0000-4000-8000-000000000005";
  const taskId = "00000000-0000-4000-8000-000000000006";
  const actorId = "00000000-0000-4000-8000-000000000007";
  const lessonId = "00000000-0000-4000-8000-000000000008";
  const chapterId = "00000000-0000-4000-8000-000000000009";

  function setup() {
    const request = {
      schemaVersion: 1,
      contextRequestId,
      sessionId,
      requestId,
      taskId,
      taskFence: 2,
      courseId,
      language: "en",
      lessonIds: [lessonId],
      targetKinds: ["lesson"],
      requestHash: "request-hash",
    };
    const binding = {
      id: "00000000-0000-4000-8000-000000000010",
      tenantId,
      courseId,
      sessionId,
      actorId,
      language: "en",
      cursorSequence: 4,
    };
    const repository = {
      findRequest: jest.fn().mockResolvedValue({
        request: { status: "pending", payload: request },
        binding,
      }),
      markFailed: jest.fn().mockResolvedValue(undefined),
      markFulfilled: jest.fn().mockResolvedValue(undefined),
    };
    const detailLesson = {
      id: lessonId,
      title: "Selected lesson",
      lessonType: "content",
      assessmentAttemptCount: 0,
      displayOrder: 1,
      baselineHash: "lesson-detail-baseline",
      description: "Selected description",
    };
    const context = {
      getContext: jest.fn().mockResolvedValue({
        courseId,
        language: "en",
        baselineHash: "course-baseline",
        chapters: [
          {
            id: chapterId,
            title: "Chapter",
            displayOrder: 1,
            baselineHash: "chapter-baseline",
            deletionBaselineHash: "chapter-deletion-baseline",
            lessons: [{ id: lessonId, baselineHash: "lesson-structural-baseline" }],
          },
        ],
      }),
      getSelectedLessonDetails: jest.fn().mockResolvedValue({
        courseId,
        language: "en",
        chapters: [{ id: chapterId, title: "Chapter", displayOrder: 1, lessons: [detailLesson] }],
      }),
    };
    const fulfillContext = jest.fn().mockResolvedValue({
      contextRequestId,
      taskId,
      resumed: true,
      dispatchId: "00000000-0000-4000-8000-000000000011",
    });
    const failContext = jest.fn().mockResolvedValue({
      contextRequestId,
      taskId,
      status: "failed",
      failureHash: "failure-hash",
    });
    const user = { id: actorId, email: "author@example.test" };
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({ where: jest.fn().mockResolvedValue([user]) })),
      })),
    };
    const worker = new CourseAuthoringContextBridgeWorker(
      { getConnection: jest.fn() } as never,
      {} as never,
      repository as never,
      context as never,
      {
        getLumaClient: jest.fn().mockResolvedValue({ authoring: { fulfillContext, failContext } }),
      } as never,
      db as never,
    );
    const tenantRunner = {
      runWithTenant: jest.fn((_tenantId: string, callback: () => Promise<unknown>) => callback()),
    };
    return { worker, tenantRunner, repository, context, fulfillContext, failContext, request, db };
  }

  it("rechecks the bound actor and sends only selected lesson details with fresh baselines", async () => {
    const test = setup();

    await test.worker.handleJob({ tenantId, contextRequestId }, test.tenantRunner as never);

    expect(test.tenantRunner.runWithTenant).toHaveBeenCalledWith(tenantId, expect.any(Function));
    expect(test.context.getSelectedLessonDetails).toHaveBeenCalledWith(
      courseId,
      "en",
      [lessonId],
      expect.objectContaining({ userId: actorId, tenantId, email: "author@example.test" }),
    );
    expect(test.fulfillContext).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId, contextRequestId }),
    );
    const response = test.fulfillContext.mock.calls[0][0].response;
    expect(response.courseBaselineHash).toBe("course-baseline");
    expect(response.chapters).toEqual([
      expect.objectContaining({
        id: chapterId,
        baselineHash: "chapter-baseline",
        deletionBaselineHash: "chapter-deletion-baseline",
        lessons: [expect.objectContaining({ id: lessonId, description: "Selected description" })],
      }),
    ]);
    expect(test.repository.markFulfilled).toHaveBeenCalledWith(tenantId, contextRequestId);
  });

  it("fails closed and marks the request failed when the bound actor loses course access", async () => {
    const test = setup();
    test.context.getContext.mockRejectedValue(new ForbiddenException("revoked"));

    await expect(
      test.worker.handleJob({ tenantId, contextRequestId }, test.tenantRunner as never),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(test.repository.markFailed).toHaveBeenCalledWith(
      tenantId,
      contextRequestId,
      "permission_revoked",
    );
    expect(test.failContext).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        contextRequestId,
        failure: expect.objectContaining({ reasonCode: "permission_revoked" }),
      }),
    );
    expect(test.fulfillContext).not.toHaveBeenCalled();
  });

  it("does not redeliver a request after its durable status is fulfilled", async () => {
    const test = setup();
    test.repository.findRequest.mockResolvedValueOnce({
      request: { status: "fulfilled", payload: test.request },
      binding: {},
    });

    await test.worker.handleJob({ tenantId, contextRequestId }, test.tenantRunner as never);

    expect(test.fulfillContext).not.toHaveBeenCalled();
    expect(test.repository.markFulfilled).not.toHaveBeenCalled();
  });
});
