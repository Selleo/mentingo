import { StudentLessonProgressService } from "./studentLessonProgress.service";

import type { DatabasePg } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";
import type { OutboxPublisher } from "src/outbox/outbox.publisher";

describe("StudentLessonProgressService.markLessonAsIncomplete", () => {
  const actor = { userId: "student" } as ActorUserType;
  const params = {
    id: "lesson",
    studentId: "student",
    actor: actor as never,
    userPermissions: [],
  };

  function setup() {
    const lesson = {
      id: "lesson",
      chapterId: "chapter",
      chapterLessonCount: 1,
      courseId: "course",
    };
    const selectQuery = {
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([lesson]),
    };
    const updateQuery = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: "progress" }]),
    };
    const transaction = {
      select: jest.fn().mockReturnValue(selectQuery),
      update: jest.fn().mockReturnValue(updateQuery),
    };
    const db = {
      select: jest.fn().mockReturnValue(selectQuery),
      update: jest.fn().mockReturnValue(updateQuery),
      transaction: jest.fn(async (callback: (trx: unknown) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const outboxPublisher = { publishDurable: jest.fn() };
    const service = new StudentLessonProgressService(
      db as unknown as DatabasePg,
      {} as never,
      {} as never,
      outboxPublisher as unknown as OutboxPublisher,
      {} as never,
      {} as never,
    );
    const methods = service as unknown as {
      checkLessonAssignment: jest.Mock;
      resolveLearningModeStatusByPermissions: jest.Mock;
      ensureDraftCourseProgressAllowed: jest.Mock;
      canUseLearnerProgressByPermissions: jest.Mock;
      resolveActor: jest.Mock;
      updateChapterProgress: jest.Mock;
      checkCourseIsCompletedForUser: jest.Mock;
    };
    methods.checkLessonAssignment = jest.fn().mockResolvedValue([
      {
        courseStatus: "published",
        isCourseAuthor: false,
        isAssigned: true,
        isFreemium: false,
      },
    ]);
    methods.resolveLearningModeStatusByPermissions = jest.fn().mockResolvedValue(false);
    methods.ensureDraftCourseProgressAllowed = jest.fn();
    methods.canUseLearnerProgressByPermissions = jest.fn().mockReturnValue(true);
    methods.resolveActor = jest.fn().mockResolvedValue(actor);
    methods.updateChapterProgress = jest.fn();
    methods.checkCourseIsCompletedForUser = jest.fn();
    return { db, transaction, outboxPublisher, methods, service };
  }

  it("rolls progress changes and durable invalidation into one transaction", async () => {
    const { db, transaction, outboxPublisher, methods, service } = setup();
    const failure = new Error("Outbox unavailable");
    outboxPublisher.publishDurable.mockRejectedValue(failure);

    await expect(service.markLessonAsIncomplete(params)).rejects.toBe(failure);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(methods.checkLessonAssignment).toHaveBeenCalledWith("lesson", "student", transaction);
    expect(transaction.select).toHaveBeenCalledTimes(1);
    expect(transaction.update).toHaveBeenCalledTimes(1);
    expect(db.select).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(methods.updateChapterProgress).toHaveBeenCalledWith(
      "course",
      "chapter",
      "student",
      1,
      false,
      actor,
      transaction,
    );
    expect(methods.checkCourseIsCompletedForUser).toHaveBeenCalledWith(
      "course",
      "student",
      actor,
      transaction,
    );
    expect(outboxPublisher.publishDurable).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: "student", lessonId: "lesson", courseId: "course", actor },
      }),
      transaction,
    );
  });

  it("uses an existing transaction without opening a nested one", async () => {
    const { db, transaction, outboxPublisher, service } = setup();
    outboxPublisher.publishDurable.mockResolvedValue(undefined);

    await service.markLessonAsIncomplete({ ...params, dbInstance: transaction as never });

    expect(db.transaction).not.toHaveBeenCalled();
    expect(outboxPublisher.publishDurable).toHaveBeenCalledWith(expect.anything(), transaction);
  });
});
