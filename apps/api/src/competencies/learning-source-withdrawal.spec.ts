import { AiService } from "src/ai/services/ai.service";
import { CertificatesService } from "src/certificates/certificates.service";
import { LearningSourceWithdrawnEvent } from "src/events/learning/learning-source-withdrawn.event";
import { LessonProgressChangedEvent } from "src/events/lesson/lesson-progress-changed.event";
import { LessonService } from "src/lesson/services/lesson.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

const actor = {
  userId: "learner",
  tenantId: "tenant",
  email: "learner@example.test",
  permissions: [],
  roleSlugs: [],
} as CurrentUserType;
const lessonId = "lesson";
const courseId = "course";
type TestTransaction = { transaction: true; execute: jest.Mock };

function transactionHarness() {
  const trx: TestTransaction = { transaction: true, execute: jest.fn() };
  let committed = false;
  const transaction = jest.fn(async (work: (trx: TestTransaction) => Promise<unknown>) => {
    const result = await work(trx);
    committed = true;
    return result;
  });
  return { trx, transaction, didCommit: () => committed };
}

function publisher(reject = false) {
  return {
    publishDurable: jest.fn(async (_event: object, _transaction?: object) => {
      if (reject) throw new Error("outbox unavailable");
    }),
  };
}

function lessonService(outboxPublisher: ReturnType<typeof publisher>) {
  const tx = transactionHarness();
  const service = Object.create(LessonService.prototype) as LessonService;
  Object.assign(service as unknown as Record<string, unknown>, {
    db: tx,
    assertStudentProgressMutationAllowed: jest.fn(),
    lessonRepository: {
      checkLessonAssignment: jest.fn().mockResolvedValue([
        {
          lessonIsCompleted: true,
          isAssigned: true,
          attempts: 1,
          chapterId: "chapter",
          courseId,
          updatedAt: new Date(),
        },
      ]),
      getLessonSettings: jest.fn().mockResolvedValue({ attemptsLimit: 3 }),
    },
    studentLessonProgressService: { updateQuizProgress: jest.fn() },
    outboxPublisher,
  });
  return { service, tx };
}

function aiService(outboxPublisher: ReturnType<typeof publisher>) {
  const tx = transactionHarness();
  const service = Object.create(AiService.prototype) as AiService;
  Object.assign(service as unknown as Record<string, unknown>, {
    db: tx,
    aiRepository: {
      checkLessonAssignment: jest
        .fn()
        .mockResolvedValue([{ isAssigned: true, isFreemium: false, courseId }]),
      setThreadsToArchived: jest.fn(),
      resetStudentProgressForLesson: jest.fn(),
    },
    outboxPublisher,
  });
  return { service, tx };
}

function certificatesService(outboxPublisher: ReturnType<typeof publisher>) {
  const tx = transactionHarness();
  const service = Object.create(CertificatesService.prototype) as CertificatesService;
  Object.assign(service as unknown as Record<string, unknown>, {
    db: tx,
    outboxPublisher,
    assertCanManageCourseCertificates: jest.fn(),
    resolveCertificatesForReset: jest
      .fn()
      .mockResolvedValue([{ id: "certificate", userId: actor.userId, courseId }]),
    certificateRepository: {
      findProgressResetTargetsForCertificates: jest
        .fn()
        .mockImplementation((ids: string[]) =>
          ids.length ? [{ courseId, userIds: [actor.userId] }] : [],
        ),
    },
    archiveAndResetCertificates: jest.fn(),
    recordCertificateActivities: jest.fn(),
  });
  return { service, tx };
}

describe("durable learning-source withdrawals", () => {
  it("records quiz retakes in the mutation transaction and propagates outbox failure", async () => {
    const outbox = publisher();
    const { service, tx } = lessonService(outbox);
    await service.deleteStudentQuizAnswers(lessonId, actor);
    expect(outbox.publishDurable).toHaveBeenCalledWith(
      expect.any(LessonProgressChangedEvent),
      tx.trx,
    );
    expect(tx.didCommit()).toBe(true);

    const failedPublisher = publisher(true);
    const failed = lessonService(failedPublisher);
    await expect(failed.service.deleteStudentQuizAnswers(lessonId, actor)).rejects.toThrow(
      "quizResetFailed",
    );
    expect(failed.tx.didCommit()).toBe(false);
  });

  it("records AI retakes in the mutation transaction and propagates outbox failure", async () => {
    const outbox = publisher();
    const { service, tx } = aiService(outbox);
    await service.retakeLesson(lessonId, actor);
    expect(outbox.publishDurable).toHaveBeenCalledWith(
      expect.any(LessonProgressChangedEvent),
      tx.trx,
    );
    expect(tx.didCommit()).toBe(true);

    const failedPublisher = publisher(true);
    const failed = aiService(failedPublisher);
    await expect(failed.service.retakeLesson(lessonId, actor)).rejects.toThrow(
      "outbox unavailable",
    );
    expect(failed.tx.didCommit()).toBe(false);
  });

  it("records certificate resets without email and propagates outbox failure", async () => {
    const outbox = publisher();
    const { service, tx } = certificatesService(outbox);
    await service.resetCourseCertificates("course", { sendEmail: false } as never, actor);
    const [event, usedTransaction] = outbox.publishDurable.mock.calls[0];
    expect(event).toBeInstanceOf(LearningSourceWithdrawnEvent);
    expect(event).toMatchObject({ data: { userId: actor.userId, courseId, actor } });
    expect(usedTransaction).toBe(tx.trx);
    expect(tx.didCommit()).toBe(true);

    const stalePublisher = publisher();
    const stale = certificatesService(stalePublisher);
    const resolver = (
      stale.service as unknown as {
        resolveCertificatesForReset: jest.Mock;
      }
    ).resolveCertificatesForReset;
    resolver.mockResolvedValueOnce([{ id: "certificate", userId: actor.userId, courseId }]);
    resolver.mockResolvedValueOnce([]);
    await stale.service.resetCourseCertificates("course", { sendEmail: false } as never, actor);
    expect(stalePublisher.publishDurable).not.toHaveBeenCalled();
    expect(stale.tx.didCommit()).toBe(true);

    const failedPublisher = publisher(true);
    const failed = certificatesService(failedPublisher);
    await expect(
      failed.service.resetCourseCertificates("course", { sendEmail: false } as never, actor),
    ).rejects.toThrow("outbox unavailable");
    expect(failed.tx.didCommit()).toBe(false);
  });
});
