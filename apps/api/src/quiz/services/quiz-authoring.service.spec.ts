import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ASSESSMENT_ATTEMPT_LIMIT_MODES,
  LESSON_TYPES,
  type SupportedLanguages,
} from "@repo/shared";

import { QuizAuthoringService } from "./quiz-authoring.service";

import type { QuizAuthoringPersistenceService } from "./quiz-authoring-persistence.service";
import type {
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

const questions = fixture.payload.questions.map((question) => ({ ...question, photoS3Key: null }));

describe("QuizAuthoringService.saveCanonicalLesson", () => {
  const language = "en" as SupportedLanguages;
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
        baseLanguage: language,
        availableLocales: [language],
      },
      questions,
    });
    expect(updateQuizLesson).not.toHaveBeenCalled();
  });

  it("updates the existing lesson through native persistence after checking its language", async () => {
    const { service, createQuizLesson, updateQuizLesson } = setup();
    const existingQuiz = {
      lesson: { id: lessonId, chapterId, title: "Existing", description: null, displayOrder: 1 },
      assessment: {
        id: assessmentId,
        passingScorePercentage: "70",
        attemptLimitMode: ASSESSMENT_ATTEMPT_LIMIT_MODES.LIFETIME,
        maximumAttempts: 3,
        attemptCooldown: "6 hours",
        baseLanguage: language,
        availableLocales: [language],
      },
      questions,
    } as unknown as QuizAuthoringLocalizedReadModel;
    jest.spyOn(service, "getQuizLessonForAuthoring").mockResolvedValue(existingQuiz);
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
});
