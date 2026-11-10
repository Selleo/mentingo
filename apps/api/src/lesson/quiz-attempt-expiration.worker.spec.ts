import { DelayedError } from "bullmq";

import { QuizAttemptExpirationWorker } from "./quiz-attempt-expiration.worker";
import { QUIZ_ATTEMPT_EXPIRATION_JOB_NAME } from "./repositories/lesson.constants";

import type { Job } from "bullmq";
import type { QuizAttemptExpirationJobData } from "src/queue";

jest.mock("bullmq", () => ({
  ...jest.requireActual("bullmq"),
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn(), close: jest.fn() })),
}));

describe("QuizAttemptExpirationWorker", () => {
  const data = {
    tenantId: "00000000-0000-4000-8000-000000000001",
    attemptId: "00000000-0000-4000-8000-000000000002",
    actor: { userId: "00000000-0000-4000-8000-000000000003" },
  } as QuizAttemptExpirationJobData;

  function setup(finalization: unknown) {
    const finalizeExpiredQuizAttempt = jest.fn().mockResolvedValue(finalization);
    const runWithTenant = jest.fn((_tenantId: string, work: () => unknown) => work());
    const worker = new QuizAttemptExpirationWorker(
      { getConnection: jest.fn() } as never,
      { finalizeExpiredQuizAttempt } as never,
      { runWithTenant } as never,
    );
    const moveToDelayed = jest.fn();
    const job = {
      name: QUIZ_ATTEMPT_EXPIRATION_JOB_NAME,
      data,
      moveToDelayed,
    } as unknown as Job<QuizAttemptExpirationJobData>;

    return { worker, job, finalizeExpiredQuizAttempt, runWithTenant, moveToDelayed };
  }

  it("finalizes the attempt inside the job's tenant", async () => {
    const { worker, job, finalizeExpiredQuizAttempt, runWithTenant, moveToDelayed } = setup({
      status: "closed",
    });

    await worker.handleJob(job, "token");

    expect(runWithTenant).toHaveBeenCalledWith(data.tenantId, expect.any(Function));
    expect(finalizeExpiredQuizAttempt).toHaveBeenCalledWith(data.attemptId, data.actor);
    expect(moveToDelayed).not.toHaveBeenCalled();
  });

  it("re-delays a job that fired before the grace period ended", async () => {
    const { worker, job, moveToDelayed } = setup({ status: "not_expired", msUntilGraceEnds: 5000 });
    const before = Date.now();

    await expect(worker.handleJob(job, "token")).rejects.toBeInstanceOf(DelayedError);

    const [delayedUntil, token] = moveToDelayed.mock.calls[0];
    expect(token).toBe("token");
    expect(delayedUntil).toBeGreaterThanOrEqual(before + 6000);
  });

  it("rejects unexpected job names", async () => {
    const { worker, job, finalizeExpiredQuizAttempt } = setup({ status: "closed" });

    await expect(worker.handleJob({ ...job, name: "other" } as never)).rejects.toThrow(
      "Unexpected quiz attempt expiration job name: other",
    );
    expect(finalizeExpiredQuizAttempt).not.toHaveBeenCalled();
  });
});
