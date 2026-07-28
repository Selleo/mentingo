import { AI_MENTOR_ROLEPLAY_DIFFICULTY, AI_MENTOR_TYPE, SUPPORTED_LANGUAGES } from "@repo/shared";

import { AI_JUDGE_GENERATION_FAILURE_MESSAGE } from "../ai-judge-configuration-generation.constants";

import { AiJudgeConfigurationGenerationWorkflowService } from "./ai-judge-configuration-generation-workflow.service";

import type { AiJudgeConfigurationGeneratorService } from "./ai-judge-configuration-generator.service";
import type { AiJudgeConfigurationValidatorService } from "./ai-judge-configuration-validator.service";
import type {
  AiJudgeConfigurationValidationResult,
  AiJudgeGenerationProgressEvent,
  ReferencedAiJudgeConfiguration,
} from "../schemas/ai-judge-configuration-generation.schema";

jest.mock("@langfuse/tracing", () => ({
  observe: (callback: () => unknown) => callback,
  updateActiveObservation: jest.fn(),
}));

const lessonContext = {
  title: "Handle a price objection",
  aiMentorConfiguration: {
    type: AI_MENTOR_TYPE.ROLEPLAY,
    scenario: "A buyer challenges the price of the proposed solution.",
    aiRole: "Skeptical buyer",
    learnerRole: "Sales representative",
    characterGoal: "Understand whether the proposal justifies its price.",
    difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
  },
} as const;

const draft: ReferencedAiJudgeConfiguration = {
  taskGoal: "The learner agrees a concrete next step with the buyer.",
  passingThresholdPercent: 70,
  criteria: [
    {
      ref: "C1",
      title: "Clarifies the objection",
      expectedBehavior: "Asks a question before proposing a solution.",
      maxScore: 1,
      scoreGuidance: [
        { score: 0, description: "Does not investigate the objection." },
        { score: 1, description: "Clarifies the reason for the objection." },
      ],
    },
  ],
  blockingErrors: [{ ref: "B1", description: "Invents contractual guarantees." }],
};

const passedValidation: AiJudgeConfigurationValidationResult = {
  passed: true,
  summary: "The assessment is coherent.",
  issues: [],
};

const failedValidation: AiJudgeConfigurationValidationResult = {
  passed: false,
  summary: "One criterion is ambiguous.",
  issues: [
    {
      code: "criterion_ambiguous",
      severity: "error",
      target: { type: "criterion", ref: "C1" },
      message: "The expected behavior is not observable enough.",
      correction: "Describe the exact question the learner should ask.",
    },
  ],
};

const createInput = {
  mode: "create" as const,
  language: SUPPORTED_LANGUAGES.EN,
  lessonContext,
  brief: "Assess whether the learner can handle a price objection.",
};

describe("AiJudgeConfigurationGenerationWorkflowService", () => {
  const createService = () => {
    const generatorService = { generate: jest.fn() };
    const validatorService = { validate: jest.fn() };
    const service = new AiJudgeConfigurationGenerationWorkflowService(
      generatorService as unknown as AiJudgeConfigurationGeneratorService,
      validatorService as unknown as AiJudgeConfigurationValidatorService,
    );
    const progress: AiJudgeGenerationProgressEvent[] = [];

    return {
      generatorService,
      validatorService,
      service,
      progress,
      options: {
        reportProgress: (event: AiJudgeGenerationProgressEvent) => {
          progress.push(event);
        },
      },
    };
  };

  it("completes on the first semantically valid draft and strips temporary references", async () => {
    const { generatorService, validatorService, service, progress, options } = createService();
    generatorService.generate.mockResolvedValue(draft);
    validatorService.validate.mockResolvedValue(passedValidation);

    const result = await service.run(createInput, options);

    expect(result).toEqual({
      status: "completed",
      attempt: 1,
      attemptHistory: [
        {
          attempt: 1,
          changes: [],
          validation: passedValidation,
        },
      ],
      configuration: {
        ...draft,
        criteria: draft.criteria.map(({ ref: _ref, ...criterion }) => criterion),
        blockingErrors: draft.blockingErrors.map(({ ref: _ref, ...error }) => error),
      },
      validation: passedValidation,
    });
    expect(progress.map(({ status }) => status)).toEqual(["drafting", "evaluating", "completed"]);
  });

  it("pauses after semantic errors so the creator can approve another attempt", async () => {
    const { generatorService, validatorService, service, progress, options } = createService();
    generatorService.generate.mockResolvedValue(draft);
    validatorService.validate.mockResolvedValue(failedValidation);

    const result = await service.run(createInput, options);

    expect(result.status).toBe("awaiting_revision");
    expect(result.attempt).toBe(1);
    expect(generatorService.generate).toHaveBeenCalledTimes(1);
    expect(progress.map(({ status }) => status)).toEqual([
      "drafting",
      "evaluating",
      "awaiting_revision",
    ]);
  });

  it("runs an approved repair as the next attempt with preserved history", async () => {
    const { generatorService, validatorService, service, progress, options } = createService();
    const repairedDraft = {
      ...draft,
      criteria: [
        {
          ...draft.criteria[0]!,
          expectedBehavior: "Asks a focused question before proposing a solution.",
        },
      ],
    };
    generatorService.generate.mockResolvedValue(repairedDraft);
    validatorService.validate.mockResolvedValue(passedValidation);
    const firstAttempt = {
      attempt: 1,
      changes: [],
      validation: failedValidation,
    };

    const result = await service.run(
      {
        mode: "repair",
        language: SUPPORTED_LANGUAGES.EN,
        lessonContext,
        brief: createInput.brief,
        currentConfiguration: draft,
        blockingIssues: failedValidation.issues,
      },
      { ...options, attempt: 2, attemptHistory: [firstAttempt] },
    );

    expect(result).toMatchObject({
      status: "completed",
      attempt: 2,
      attemptHistory: [firstAttempt, { attempt: 2, validation: passedValidation }],
    });
    expect(progress.map(({ status }) => status)).toEqual(["drafting", "evaluating", "completed"]);
    expect(validatorService.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: repairedDraft,
        previousValidation: failedValidation,
        appliedChanges: [
          expect.objectContaining({
            targetRef: "C1",
            field: "expectedBehavior",
            after: "Asks a focused question before proposing a solution.",
          }),
        ],
      }),
    );
  });

  it("computes improvement changes from stable references", async () => {
    const { generatorService, validatorService, service, progress, options } = createService();
    const improvedDraft: ReferencedAiJudgeConfiguration = {
      ...draft,
      taskGoal: "The learner agrees and confirms a concrete next step with the buyer.",
      criteria: [
        {
          ...draft.criteria[0]!,
          expectedBehavior: "Asks a focused question before proposing a solution.",
        },
      ],
    };
    generatorService.generate.mockResolvedValue(improvedDraft);
    validatorService.validate.mockResolvedValue(passedValidation);

    const result = await service.run(
      {
        mode: "improve",
        language: SUPPORTED_LANGUAGES.EN,
        lessonContext,
        instruction: "Make the assessment more specific.",
        currentConfiguration: draft,
      },
      options,
    );

    expect(result).toMatchObject({
      status: "completed",
      changes: [
        {
          type: "changed",
          targetRef: "configuration",
          field: "taskGoal",
          before: draft.taskGoal,
          after: improvedDraft.taskGoal,
        },
        {
          type: "changed",
          targetRef: "C1",
          field: "expectedBehavior",
          before: draft.criteria[0]!.expectedBehavior,
          after: improvedDraft.criteria[0]!.expectedBehavior,
        },
      ],
    });
    expect(progress.find(({ status }) => status === "evaluating")).toMatchObject({
      changes: expect.any(Array),
    });
    expect(validatorService.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorInstruction: "Make the assessment more specific.",
        appliedChanges: expect.arrayContaining([
          expect.objectContaining({
            targetRef: "configuration",
            field: "taskGoal",
          }),
          expect.objectContaining({
            targetRef: "C1",
            field: "expectedBehavior",
          }),
        ]),
      }),
    );
  });

  it("repairs deterministic scoring defects without invoking the semantic Validator", async () => {
    const { generatorService, validatorService, service, progress, options } = createService();
    const invalidDraft: ReferencedAiJudgeConfiguration = {
      ...draft,
      criteria: [
        {
          ...draft.criteria[0],
          scoreGuidance: [
            { score: 0, description: "No evidence." },
            { score: 0, description: "Still no evidence." },
          ],
        },
      ],
    };
    generatorService.generate.mockResolvedValue(invalidDraft);
    validatorService.validate.mockResolvedValue(passedValidation);

    const result = await service.run(createInput, options);

    expect(result.status).toBe("awaiting_revision");
    expect(validatorService.validate).not.toHaveBeenCalled();
    expect(generatorService.generate).toHaveBeenCalledTimes(1);
    expect(progress.map(({ status }) => status)).toEqual([
      "drafting",
      "evaluating",
      "awaiting_revision",
    ]);
  });

  it("normalizes duplicate model references before publishing the draft", async () => {
    const { generatorService, validatorService, service, progress, options } = createService();
    const duplicateReferenceDraft: ReferencedAiJudgeConfiguration = {
      ...draft,
      blockingErrors: [
        draft.blockingErrors[0]!,
        { ref: "B1", description: "Promises an impossible deadline." },
      ],
    };
    generatorService.generate.mockResolvedValue(duplicateReferenceDraft);
    validatorService.validate.mockResolvedValue(passedValidation);

    const result = await service.run(createInput, options);

    expect(result).toMatchObject({
      status: "completed",
      configuration: {
        blockingErrors: [
          { description: "Invents contractual guarantees." },
          { description: "Promises an impossible deadline." },
        ],
      },
    });
    expect(progress.find(({ status }) => status === "evaluating")).toMatchObject({
      draft: {
        blockingErrors: [{ ref: "B1" }, { ref: "B2" }],
      },
    });
  });

  it("returns the latest draft for creator review after the third semantic failure", async () => {
    const { generatorService, validatorService, service, progress, options } = createService();
    generatorService.generate.mockResolvedValue(draft);
    validatorService.validate.mockResolvedValue(failedValidation);

    const previousAttempts = [
      { attempt: 1, changes: [], validation: failedValidation },
      { attempt: 2, changes: [], validation: failedValidation },
    ];
    const result = await service.run(createInput, {
      ...options,
      attempt: 3,
      attemptHistory: previousAttempts,
    });

    expect(result).toMatchObject({
      status: "requires_review",
      attempt: 3,
      validation: failedValidation,
    });
    expect(result.attemptHistory).toHaveLength(3);
    expect(generatorService.generate).toHaveBeenCalledTimes(1);
    expect(validatorService.validate).toHaveBeenCalledTimes(1);
    expect(progress.at(-1)?.status).toBe("requires_review");
  });

  it("cancels before starting a model call", async () => {
    const { generatorService, validatorService, service, progress, options } = createService();

    const result = await service.run(createInput, { ...options, isCancelled: () => true });

    expect(result).toEqual({
      status: "cancelled",
      attempt: 1,
      attemptHistory: [],
      configuration: undefined,
    });
    expect(generatorService.generate).not.toHaveBeenCalled();
    expect(validatorService.validate).not.toHaveBeenCalled();
    expect(progress).toEqual([result]);
  });

  it("keeps provider diagnostics out of generation progress", async () => {
    const { generatorService, service, options } = createService();
    generatorService.generate.mockRejectedValue(
      new Error("Invalid schema for response_format: missing example"),
    );

    await expect(service.run(createInput, options)).resolves.toEqual({
      status: "failed",
      attempt: 1,
      attemptHistory: [],
      message: AI_JUDGE_GENERATION_FAILURE_MESSAGE,
      configuration: undefined,
    });
  });
});
