import { AI_MENTOR_ROLEPLAY_DIFFICULTY, AI_MENTOR_TYPE, SUPPORTED_LANGUAGES } from "@repo/shared";

import { loadAiSdk } from "src/ai/utils/ai-esm";

import { AiJudgeConfigurationValidatorService } from "./ai-judge-configuration-validator.service";

import type {
  AiJudgeConfigurationValidatorStructuredOutput,
  ReferencedAiJudgeConfiguration,
} from "../schemas/ai-judge-configuration-generation.schema";
import type { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import type { PromptService } from "src/ai/services/prompt.service";

jest.mock("@langfuse/tracing", () => ({
  observe: (callback: () => unknown) => callback,
  updateActiveObservation: jest.fn(),
}));
jest.mock("src/ai/utils/ai-esm", () => ({ loadAiSdk: jest.fn() }));

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

const configuration: ReferencedAiJudgeConfiguration = {
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

describe("AiJudgeConfigurationValidatorService", () => {
  const createService = (modelResult: AiJudgeConfigurationValidatorStructuredOutput) => {
    const generateText = jest.fn().mockResolvedValue({ output: modelResult });
    jest.mocked(loadAiSdk).mockResolvedValue({
      generateText,
      jsonSchema: jest.fn((schema) => schema),
      Output: { object: jest.fn((options) => options) },
    } as never);
    const promptService = {
      loadPrompt: jest.fn().mockResolvedValue("VALIDATOR"),
      isNotEmpty: jest.fn().mockResolvedValue(undefined),
      getOpenAI: jest.fn().mockResolvedValue(jest.fn().mockReturnValue("MODEL")),
    };
    const aiRuntimeService = {
      validateJudgeConfiguration: jest.fn((_input, validateCoreConfiguration) =>
        validateCoreConfiguration(),
      ),
    };
    const service = new AiJudgeConfigurationValidatorService(
      promptService as unknown as PromptService,
      aiRuntimeService as unknown as AiRuntimeService,
    );

    return { generateText, promptService, service };
  };

  it("derives a pass when the model returns warnings only", async () => {
    const modelResult: AiJudgeConfigurationValidatorStructuredOutput = {
      summary: "The rubric is usable but could be more specific.",
      issues: [
        {
          code: "example_specificity",
          severity: "warning",
          target: { type: "scoreGuidance", ref: "C1", score: 1, field: null },
          message: "The example could be more specific.",
          correction: "Use a response grounded in the objection scenario.",
        },
      ],
    };
    const { generateText, promptService, service } = createService(modelResult);

    const result = await service.validate({
      language: SUPPORTED_LANGUAGES.EN,
      lessonContext,
      brief: "Assess objection handling.",
      configuration,
    });

    expect(promptService.loadPrompt).toHaveBeenCalledWith("aiJudgeConfigurationValidator", {
      language: SUPPORTED_LANGUAGES.EN,
    });
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "VALIDATOR",
        prompt: expect.stringContaining('"creatorBrief":"Assess objection handling."'),
      }),
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(
          '"scoringFacts":{"totalMaxScore":1,"passingThresholdPercent":70,"requiredScore":1}',
        ),
      }),
    );
    expect(result).toEqual({
      ...modelResult,
      issues: modelResult.issues.map((issue) => ({
        ...issue,
        target: { type: "scoreGuidance", ref: "C1", score: 1 },
      })),
      passed: true,
    });
  });

  it("derives a failure when any finding has error severity", async () => {
    const modelResult: AiJudgeConfigurationValidatorStructuredOutput = {
      summary: "One score level is ambiguous.",
      issues: [
        {
          code: "guidance_overlap",
          severity: "error",
          target: { type: "criterion", ref: "C1", field: null },
          message: "The score levels overlap.",
          correction: "Differentiate the observable evidence at each score.",
        },
      ],
    };
    const { service } = createService(modelResult);

    await expect(
      service.validate({
        language: SUPPORTED_LANGUAGES.EN,
        lessonContext,
        configuration,
      }),
    ).resolves.toEqual({
      ...modelResult,
      issues: modelResult.issues.map((issue) => ({
        ...issue,
        target: { type: "criterion", ref: "C1" },
      })),
      passed: false,
    });
  });

  it("includes the previous result when validating a revised draft", async () => {
    const modelResult: AiJudgeConfigurationValidatorStructuredOutput = {
      summary: "The previous issue is resolved.",
      issues: [],
    };
    const previousValidation = {
      passed: false,
      summary: "The criterion was ambiguous.",
      issues: [
        {
          code: "guidance_overlap",
          severity: "error" as const,
          target: { type: "criterion" as const, ref: "C1" as const },
          message: "Adjacent scores overlap.",
          correction: "Separate the observable evidence.",
        },
      ],
    };
    const { generateText, service } = createService(modelResult);
    const appliedChanges = [
      {
        type: "changed" as const,
        targetRef: "configuration" as const,
        field: "passingThresholdPercent" as const,
        before: 70,
        after: 80,
      },
    ];

    await service.validate({
      language: SUPPORTED_LANGUAGES.EN,
      lessonContext,
      configuration,
      creatorInstruction: "Make partial scoring observable.",
      appliedChanges,
      previousValidation,
    });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('"creatorInstruction":"Make partial scoring observable."'),
      }),
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(`"appliedChanges":${JSON.stringify(appliedChanges)}`),
      }),
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(
          `"previousValidation":${JSON.stringify(previousValidation)}`,
        ),
      }),
    );
  });

  it.each([
    {
      target: { type: "criterion" as const, ref: "C9" as const, field: null },
      error: "Validator referenced unknown criterion C9",
    },
    {
      target: {
        type: "scoreGuidance" as const,
        ref: "C1" as const,
        score: 4,
        field: null,
      },
      error: "Validator referenced unknown score 4 for criterion C1",
    },
    {
      target: { type: "blockingError" as const, ref: "B9" as const, field: null },
      error: "Validator referenced unknown blocking error B9",
    },
  ])("rejects hallucinated model target $target", async ({ target, error }) => {
    const modelResult = {
      summary: "Invalid target.",
      issues: [
        {
          code: "invalid_target",
          severity: "error" as const,
          target,
          message: "Target does not exist.",
          correction: "Use an existing target.",
        },
      ],
    } as AiJudgeConfigurationValidatorStructuredOutput;
    const { service } = createService(modelResult);

    await expect(
      service.validate({
        language: SUPPORTED_LANGUAGES.EN,
        lessonContext,
        configuration,
      }),
    ).rejects.toThrow(error);
  });
});
