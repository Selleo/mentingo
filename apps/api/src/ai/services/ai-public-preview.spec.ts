import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";

import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import { AiService } from "src/ai/services/ai.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

jest.mock("@langfuse/tracing", () => ({
  observe: (fn: () => unknown) => fn,
  propagateAttributes: (_attributes: unknown, fn: () => unknown) => fn(),
  updateActiveObservation: jest.fn(),
}));

const lessonId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const threadId = "33333333-3333-4333-8333-333333333333";
const student = {
  userId,
  tenantId: lessonId,
  permissions: [PERMISSIONS.COURSE_READ, PERMISSIONS.LEARNING_PROGRESS_UPDATE, PERMISSIONS.AI_USE],
} as CurrentUserType;

function fixture(preview = true, enrolled = false) {
  const aiRepository = {
    getCourseAuthorByLesson: jest.fn(async () => userId),
    findThread: jest.fn(async () => ({
      id: threadId,
      userId,
      status: "active",
      aiMentorLessonId: lessonId,
    })),
    findLessonIdByThreadId: jest.fn(async () => ({ lessonId, courseId: lessonId })),
    checkLessonAssignment: jest.fn(async () => [
      { isAssigned: enrolled, isFreemium: false, courseId: lessonId },
    ]),
    getHasPublicCoursePreviewAccess: jest.fn(async () => preview),
    setThreadsToArchived: jest.fn(),
    resetStudentProgressForLesson: jest.fn(),
  };
  const stream = { source: AI_RUNTIME_SOURCES.CORE };
  const aiRuntimeService = { streamMentorChat: jest.fn(async () => stream) };
  const judgeService = { evaluate: jest.fn() };
  const outboxPublisher = { publish: jest.fn() };
  const service = Object.assign(Object.create(AiService.prototype), {
    aiRepository,
    aiRuntimeService,
    judgeService,
    summaryService: { summarizeThreadOnTokenThreshold: jest.fn() },
    promptService: { buildPrompt: jest.fn(async () => []) },
    db: { transaction: (fn: (trx: unknown) => Promise<unknown>) => fn({}) },
    outboxPublisher,
  }) as AiService;
  return { service, aiRepository, aiRuntimeService, judgeService, outboxPublisher, stream };
}

describe("public course AI Mentor previews", () => {
  it("streams an author's voice preview without enrollment or progress writes", async () => {
    const { service, stream, aiRepository, judgeService, outboxPublisher } = fixture(false);
    await expect(
      service.streamMessage(
        { threadId, content: "Voice preview" },
        "model" as never,
        {
          ...student,
          permissions: [PERMISSIONS.COURSE_UPDATE_OWN, PERMISSIONS.AI_USE],
        },
        true,
      ),
    ).resolves.toBe(stream);
    expect(aiRepository.resetStudentProgressForLesson).not.toHaveBeenCalled();
    expect(judgeService.evaluate).not.toHaveBeenCalled();
    expect(outboxPublisher.publish).not.toHaveBeenCalled();
  });

  it("does not grant another author access to an unassigned voice conversation", async () => {
    const { service, aiRepository, aiRuntimeService } = fixture(false);
    aiRepository.getCourseAuthorByLesson.mockResolvedValue(lessonId);
    await expect(
      service.streamMessage(
        { threadId, content: "Voice preview" },
        "model" as never,
        {
          ...student,
          permissions: [PERMISSIONS.COURSE_UPDATE_OWN, PERMISSIONS.AI_USE],
        },
        true,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(aiRuntimeService.streamMentorChat).not.toHaveBeenCalled();
  });

  it("allows an eligible unenrolled student's own chat without learning progress events", async () => {
    const { service, aiRuntimeService, outboxPublisher, stream } = fixture();
    await expect(
      service.streamMessage({ threadId, content: "Hello" }, "model" as never, student),
    ).resolves.toBe(stream);
    expect(aiRuntimeService.streamMentorChat).toHaveBeenCalledTimes(1);
    expect(outboxPublisher.publish).not.toHaveBeenCalled();
  });

  it("checks eligibility again before streaming, including when the organization disables previews", async () => {
    const { service, aiRuntimeService } = fixture(false);
    await expect(
      service.streamMessage({ threadId, content: "Hello" }, "model" as never, student),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(aiRuntimeService.streamMentorChat).not.toHaveBeenCalled();
  });

  it("does not allow chatting on another student's thread", async () => {
    const { service, aiRuntimeService } = fixture();
    await expect(
      service.streamMessage({ threadId, content: "Hello" }, "model" as never, {
        ...student,
        userId: lessonId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(aiRuntimeService.streamMentorChat).not.toHaveBeenCalled();
  });

  it("keeps enrolled student chat working when public previews are disabled", async () => {
    const { service, stream } = fixture(false, true);
    await expect(
      service.streamMessage({ threadId, content: "Hello" }, "model" as never, student),
    ).resolves.toBe(stream);
  });

  it("retakes an eligible public conversation without resetting progress or emitting completion reactions", async () => {
    const { service, aiRepository, outboxPublisher } = fixture();
    await service.retakeLesson(lessonId, student);
    expect(aiRepository.setThreadsToArchived).toHaveBeenCalledWith(
      lessonId,
      userId,
      expect.anything(),
    );
    expect(aiRepository.resetStudentProgressForLesson).not.toHaveBeenCalled();
    expect(outboxPublisher.publish).not.toHaveBeenCalled();
  });

  it("denies an unenrolled retake when preview eligibility is revoked", async () => {
    const { service, aiRepository } = fixture(false);
    await expect(service.retakeLesson(lessonId, student)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(aiRepository.setThreadsToArchived).not.toHaveBeenCalled();
  });

  it("preserves the normal progress reset for an enrolled student's retake", async () => {
    const { service, aiRepository, outboxPublisher } = fixture(false, true);
    await service.retakeLesson(lessonId, student);
    expect(aiRepository.resetStudentProgressForLesson).toHaveBeenCalled();
    expect(outboxPublisher.publish).toHaveBeenCalled();
  });

  it("denies public-preview grading before calling the judge", async () => {
    const { service, judgeService } = fixture();
    await expect(service.runJudge({ threadId, userId }, student)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(judgeService.evaluate).not.toHaveBeenCalled();
  });
});
