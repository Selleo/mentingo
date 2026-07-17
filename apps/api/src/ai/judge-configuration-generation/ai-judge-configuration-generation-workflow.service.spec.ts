import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { AiJudgeConfigurationGenerationWorkflowService } from "./ai-judge-configuration-generation-workflow.service";

import type {
  AiJudgeConfigurationValidationResult,
  AiJudgeGenerationProgressEvent,
  ReferencedAiJudgeConfiguration,
} from "./ai-judge-configuration-generation.schema";
import type { AiJudgeConfigurationGeneratorService } from "./ai-judge-configuration-generator.service";
import type { AiJudgeConfigurationValidatorService } from "./ai-judge-configuration-validator.service";

jest.mock("@langfuse/tracing", () => ({
  observe: (callback: () => unknown) => callback,
  updateActiveObservation: jest.fn(),
}));

const lessonContext = {
  title: "Handle a price objection",
  aiMentorType: "roleplay",
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
      configuration: {
        ...draft,
        criteria: draft.criteria.map(({ ref: _ref, ...criterion }) => criterion),
        blockingErrors: draft.blockingErrors.map(({ ref: _ref, ...error }) => error),
      },
      validation: passedValidation,
    });
    expect(progress.map(({ status }) => status)).toEqual(["drafting", "evaluating", "completed"]);
  });

  it("sends semantic errors to focused repair and then reevaluates", async () => {
    const { generatorService, validatorService, service, progress, options } = createService();
    generatorService.generate.mockResolvedValue(draft);
    validatorService.validate
      .mockResolvedValueOnce(failedValidation)
      .mockResolvedValueOnce(passedValidation);

    const result = await service.run(createInput, options);

    expect(result.status).toBe("completed");
    expect(result.attempt).toBe(2);
    expect(generatorService.generate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        mode: "repair",
        currentConfiguration: draft,
        blockingIssues: failedValidation.issues,
      }),
    );
    expect(progress.map(({ status }) => status)).toEqual([
      "drafting",
      "evaluating",
      "revising",
      "drafting",
      "evaluating",
      "completed",
    ]);
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
    generatorService.generate.mockResolvedValueOnce(invalidDraft).mockResolvedValueOnce(draft);
    validatorService.validate.mockResolvedValue(passedValidation);

    await service.run(createInput, options);

    expect(validatorService.validate).toHaveBeenCalledTimes(1);
    expect(generatorService.generate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        mode: "repair",
        blockingIssues: expect.arrayContaining([
          expect.objectContaining({ code: "duplicate_guidance_score" }),
          expect.objectContaining({ code: "missing_guidance_scores" }),
        ]),
      }),
    );
    expect(progress.map(({ status }) => status)).toEqual([
      "drafting",
      "revising",
      "drafting",
      "evaluating",
      "completed",
    ]);
  });

  it("returns the latest draft for creator review after the third semantic failure", async () => {
    const { generatorService, validatorService, service, progress, options } = createService();
    generatorService.generate.mockResolvedValue(draft);
    validatorService.validate.mockResolvedValue(failedValidation);

    const result = await service.run(createInput, options);

    expect(result).toMatchObject({
      status: "requires_review",
      attempt: 3,
      validation: failedValidation,
    });
    expect(generatorService.generate).toHaveBeenCalledTimes(3);
    expect(validatorService.validate).toHaveBeenCalledTimes(3);
    expect(progress.at(-1)?.status).toBe("requires_review");
  });

  it("cancels before starting a model call", async () => {
    const { generatorService, validatorService, service, progress, options } = createService();

    const result = await service.run(createInput, { ...options, isCancelled: () => true });

    expect(result).toEqual({ status: "cancelled", attempt: 1, configuration: undefined });
    expect(generatorService.generate).not.toHaveBeenCalled();
    expect(validatorService.validate).not.toHaveBeenCalled();
    expect(progress).toEqual([result]);
  });
});
