import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ASSESSMENT_ATTEMPT_LIMIT_MODES,
  ASSESSMENT_FEEDBACK_MODES,
  ASSESSMENT_TIME_LIMIT_MINUTES,
  ASSESSMENT_SCORING_MODES,
  LESSON_TYPES,
  type SupportedLanguages,
} from "@repo/shared";

import { QuizAuthoringService } from "./quiz-authoring.service";

import type { QuizAuthoringPersistenceService } from "./quiz-authoring-persistence.service";
import type {
  QuizAuthoringFeedbackRange,
  QuizAuthoringInput,
  QuizAuthoringLocalizedReadModel,
  QuizAuthoringQuestion,
} from "../types/quiz-authoring.types";

const fixture = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../../../../docs/contracts/course-authoring/quiz-operation.json"),
    "utf8",
  ),
) as { payload: { questions: QuizAuthoringQuestion[] } };

const questions = fixture.payload.questions.map((question) => ({
  ...question,
  photoS3Key: null,
  scoringMode: ASSESSMENT_SCORING_MODES.ALL_OR_NOTHING,
  matchingPairs: [],
}));

describe("QuizAuthoringService.saveCanonicalLesson", () => {
  const language = "en" as SupportedLanguages;
  const translatedLanguage = "pl" as SupportedLanguages;
  const chapterId = "00000000-0000-4000-8000-000000000001";
  const lessonId = "00000000-0000-4000-8000-000000000002";
  const assessmentId = "00000000-0000-4000-8000-000000000003";

  function setup() {
    const createQuizLesson = jest.fn();
    const updateQuizLesson = jest.fn();
    const persistenceService = {
      createQuizLesson,
      updateQuizLesson,
    } as unknown as QuizAuthoringPersistenceService;
    const service = new QuizAuthoringService(
      {} as never,
      persistenceService,
      {} as never,
      { createResourceForEntity: jest.fn() } as never,
    );

    return { service, createQuizLesson, updateQuizLesson };
  }

  function makeInput(): QuizAuthoringInput {
    return {
      chapterId,
      title: "Canonical assessment",
      description: "Assessment description",
      thresholdScore: 80,
      attemptsLimit: 3,
      quizCooldownInHours: 6,
      displayOrder: 4,
      language,
      questions,
    };
  }

  function makeExistingQuiz(
    feedbackRanges: QuizAuthoringFeedbackRange[] = [],
  ): QuizAuthoringLocalizedReadModel {
    return {
      lesson: { id: lessonId, chapterId, title: "Existing", description: null, displayOrder: 1 },
      assessment: {
        id: assessmentId,
        passingScorePercentage: "70",
        attemptLimitMode: ASSESSMENT_ATTEMPT_LIMIT_MODES.LIFETIME,
        maximumAttempts: 3,
        attemptCooldown: "6 hours",
        baseLanguage: language,
        availableLocales: [language, translatedLanguage],
      },
      feedbackRanges,
      questions,
    } as unknown as QuizAuthoringLocalizedReadModel;
  }

  it("creates through the native persistence service while retaining canonical question IDs", async () => {
    const { service, createQuizLesson, updateQuizLesson } = setup();
    const createdLesson = { id: lessonId };
    createQuizLesson.mockResolvedValue(createdLesson);

    await expect(service.saveCanonicalLesson(makeInput())).resolves.toBe(createdLesson);

    expect(createQuizLesson).toHaveBeenCalledWith({
      language,
      lesson: {
        chapterId,
        type: LESSON_TYPES.QUIZ,
        title: "Canonical assessment",
        description: "Assessment description",
        thresholdScore: 80,
        attemptsLimit: 3,
        quizCooldownInHours: 6,
        displayOrder: 4,
      },
      assessment: {
        passingScorePercentage: "80",
        attemptLimitMode: ASSESSMENT_ATTEMPT_LIMIT_MODES.LIFETIME,
        maximumAttempts: 3,
        attemptCooldown: "6 hours",
        timeLimitMinutes: null,
        feedbackMode: ASSESSMENT_FEEDBACK_MODES.FULL,
        baseLanguage: language,
        availableLocales: [language],
      },
      feedbackRanges: [],
      questions,
    });
    expect(updateQuizLesson).not.toHaveBeenCalled();
  });

  it("stores a quiz time limit within the allowed range", async () => {
    const { service, createQuizLesson } = setup();
    createQuizLesson.mockResolvedValue({ id: lessonId });

    await service.saveCanonicalLesson({ ...makeInput(), timeLimitMinutes: 45 });

    expect(createQuizLesson).toHaveBeenCalledWith(
      expect.objectContaining({ assessment: expect.objectContaining({ timeLimitMinutes: 45 }) }),
    );
  });

  it.each([0, ASSESSMENT_TIME_LIMIT_MINUTES.MAX + 1, 1.5])(
    "rejects a quiz time limit of %p minutes",
    async (timeLimitMinutes) => {
      const { service, createQuizLesson } = setup();

      await expect(
        service.saveCanonicalLesson({ ...makeInput(), timeLimitMinutes }),
      ).rejects.toThrow();
      expect(createQuizLesson).not.toHaveBeenCalled();
    },
  );

  it("updates the existing lesson through native persistence after checking its language", async () => {
    const { service, createQuizLesson, updateQuizLesson } = setup();
    jest.spyOn(service, "getQuizLessonForAuthoring").mockResolvedValue(makeExistingQuiz());
    const updatedAssessment = { id: assessmentId };
    updateQuizLesson.mockResolvedValue(updatedAssessment);

    await expect(service.saveCanonicalLesson(makeInput(), lessonId)).resolves.toBe(
      updatedAssessment,
    );

    expect(updateQuizLesson).toHaveBeenCalledWith({
      lessonId,
      lesson: {
        language,
        title: "Canonical assessment",
        description: "Assessment description",
        thresholdScore: 80,
        attemptsLimit: 3,
        quizCooldownInHours: 6,
      },
      assessment: {
        passingScorePercentage: "80",
        attemptLimitMode: ASSESSMENT_ATTEMPT_LIMIT_MODES.LIFETIME,
        maximumAttempts: 3,
        attemptCooldown: "6 hours",
      },
      questions,
    });
    expect(createQuizLesson).not.toHaveBeenCalled();
  });

  describe("translated feedback ranges", () => {
    const lowRangeId = "00000000-0000-4000-8000-000000000010";
    const highRangeId = "00000000-0000-4000-8000-000000000011";
    const storedRanges: QuizAuthoringFeedbackRange[] = [
      { id: lowRangeId, minPercent: 0, maxPercent: 49, message: "Low" },
      { id: highRangeId, minPercent: 50, maxPercent: 100, message: "High" },
    ];
    const saveTranslated = (feedbackRanges: QuizAuthoringFeedbackRange[]) => {
      const { service, updateQuizLesson } = setup();
      jest
        .spyOn(service, "getQuizLessonForAuthoring")
        .mockResolvedValue(makeExistingQuiz(storedRanges));
      updateQuizLesson.mockResolvedValue({ id: assessmentId });

      const result = service.saveCanonicalLesson(
        { ...makeInput(), language: translatedLanguage, feedbackRanges },
        lessonId,
      );

      return { result, updateQuizLesson };
    };

    it("saves messages when the band structure matches the stored one", async () => {
      const translatedRanges = storedRanges.map((range) => ({
        ...range,
        message: "Przetłumaczone",
      }));
      const { result, updateQuizLesson } = saveTranslated(translatedRanges);

      await expect(result).resolves.toEqual({ id: assessmentId });
      expect(updateQuizLesson).toHaveBeenCalledWith(
        expect.objectContaining({ feedbackRanges: translatedRanges }),
      );
    });

    it.each([
      [
        "changed bounds",
        [
          { ...storedRanges[0], maxPercent: 59 },
          { ...storedRanges[1], minPercent: 60 },
        ],
      ],
      ["a missing id", [storedRanges[0], { ...storedRanges[1], id: undefined }]],
      ["a repeated id", [storedRanges[0], { ...storedRanges[1], id: lowRangeId }]],
      [
        "an extra band",
        [
          storedRanges[0],
          { ...storedRanges[1], maxPercent: 89 },
          { minPercent: 90, maxPercent: 100, message: "" },
        ],
      ],
      ["a removed band", [{ ...storedRanges[0], maxPercent: 100 }]],
    ])("rejects a translated save with %s", async (_, feedbackRanges) => {
      const { result, updateQuizLesson } = saveTranslated(feedbackRanges);

      await expect(result).rejects.toThrow("adminCourseView.errors.lesson.quizCreateFailed");
      expect(updateQuizLesson).not.toHaveBeenCalled();
    });
  });
});
