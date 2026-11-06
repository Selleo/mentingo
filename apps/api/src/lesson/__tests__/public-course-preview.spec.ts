import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";

import { courseLearningContext } from "src/course-repetition/course-learning-context";

import { LESSON_TYPES } from "../lesson.type";
import { LessonService } from "../services/lesson.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

describe("public course lesson preview", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const user = {
    userId: id,
    tenantId: id,
    permissions: [PERMISSIONS.COURSE_READ, PERMISSIONS.LEARNING_PROGRESS_UPDATE],
  } as CurrentUserType;

  function fixture(type = LESSON_TYPES.CONTENT as string, preview = true) {
    const lesson = {
      id,
      type,
      isEnrolled: false,
      isFreemium: false,
      lessonCompleted: true,
      quizScore: 80,
      attempts: 2,
      isQuizPassed: true,
    };
    const repository = {
      getHasPublicCoursePreviewAccess: jest.fn(async () => preview),
      getHasLessonAccess: jest.fn(async () => false),
      getLessonProgress: jest.fn(async () => undefined),
      getLessonDetails: jest.fn(async () => lesson),
      checkLessonAssignment: jest.fn(async () => [{ isAssigned: false, isFreemium: false }]),
      getResource: jest.fn(async () => ({ entityId: id, entityType: "lesson", reference: "file" })),
    };
    const started = jest.fn();
    const quizDelivery = jest.fn(async () => ({ questions: [] }));
    const aiService = {
      getOrCreateLessonThread: jest.fn(),
      getExistingThreadForLesson: jest.fn(),
    };
    const service = Object.assign(Object.create(LessonService.prototype), {
      lessonRepository: repository,
      localizationService: { getBaseLanguage: jest.fn(async () => ({ language: "en" })) },
      studentLessonProgressService: { markLessonAsStarted: started },
      quizRuntimeService: { getQuizForDelivery: quizDelivery, submitQuiz: jest.fn() },
      aiService,
      getContentLessonWithResources: jest.fn(async () => lesson),
      streamResource: jest.fn(),
    }) as LessonService;
    return { service, repository, started, aiService, quizDelivery };
  }

  it("reads a lesson without enrollment or sequence completion and does not start progress", async () => {
    const { service, repository, started } = fixture();
    const context = { learningStateId: null, readOnly: false };
    await courseLearningContext.run(context, () => service.getLessonById(id, id, user, "en"));
    expect(context.readOnly).toBe(true);
    expect(repository.getHasLessonAccess).not.toHaveBeenCalled();
    expect(started).not.toHaveBeenCalled();
  });

  it("keeps regular access checks when the preview policy denies access", async () => {
    const { service } = fixture(LESSON_TYPES.CONTENT, false);
    await expect(service.getLessonById(id, id, user, "en")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("returns quiz question text without grading, feedback or attempts", async () => {
    const { service, quizDelivery, started } = fixture(LESSON_TYPES.QUIZ);
    const result = await service.getLessonById(id, id, user, "en");
    expect(result.quizDetails).toEqual({
      questions: [],
      questionCount: 0,
      score: null,
      correctAnswerCount: null,
      wrongAnswerCount: null,
    });
    expect(result.isQuizFeedbackRedacted).toBe(true);
    expect(result.lessonCompleted).toBe(false);
    expect(result).toEqual(expect.objectContaining({ quizScore: null }));
    expect(result.attempts).toBeNull();
    expect(result.isQuizPassed).toBeNull();
    expect(quizDelivery).toHaveBeenCalledWith(id, "en", undefined, false);
    expect(started).not.toHaveBeenCalled();
  });

  it("does not create or expose an AI conversation during preview", async () => {
    const { service, aiService } = fixture(LESSON_TYPES.AI_MENTOR);
    const result = await service.getLessonById(id, id, user, "en");
    expect(result.threadId).toBeUndefined();
    expect(aiService.getOrCreateLessonThread).not.toHaveBeenCalled();
    expect(aiService.getExistingThreadForLesson).not.toHaveBeenCalled();
  });

  it("denies quiz submission before grading or progress changes", async () => {
    const { service } = fixture(LESSON_TYPES.QUIZ);
    await expect(
      service.evaluationQuiz({ lessonId: id, language: "en", questionsAnswers: [] }, user),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("streams attached content for authorized preview users", async () => {
    const { service, repository } = fixture();
    await service.getLessonResource({ headers: {} } as never, {} as never, user, id);
    expect(repository.getHasPublicCoursePreviewAccess).toHaveBeenCalledWith(id, id);
  });

  it("does not send anonymous users through signed-in preview access", async () => {
    const { service, repository } = fixture();
    const publicRead = jest.fn(async () => ({}));
    Object.assign(service, { getPublicLessonById: publicRead });
    await service.getLessonById(id, undefined, null, "en");
    expect(publicRead).toHaveBeenCalledWith(id, "en");
    expect(repository.getHasPublicCoursePreviewAccess).not.toHaveBeenCalled();
  });
});
