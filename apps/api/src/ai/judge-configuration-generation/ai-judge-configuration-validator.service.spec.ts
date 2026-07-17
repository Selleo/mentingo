import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { loadAiSdk } from "src/ai/utils/ai-esm";

import { AiJudgeConfigurationValidatorService } from "./ai-judge-configuration-validator.service";

import type {
  AiJudgeConfigurationValidatorModelResult,
  ReferencedAiJudgeConfiguration,
} from "./ai-judge-configuration-generation.schema";
import type { PromptService } from "src/ai/services/prompt.service";

jest.mock("@langfuse/tracing", () => ({
  observe: (callback: () => unknown) => callback,
  updateActiveObservation: jest.fn(),
}));
jest.mock("src/ai/utils/ai-esm", () => ({ loadAiSdk: jest.fn() }));

const lessonContext = {
  title: "Handle a price objection",
  aiMentorType: "roleplay",
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
  const createService = (modelResult: AiJudgeConfigurationValidatorModelResult) => {
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
    const service = new AiJudgeConfigurationValidatorService(
      promptService as unknown as PromptService,
    );

    return { generateText, promptService, service };
  };

  it("derives a pass when the model returns warnings only", async () => {
    const modelResult: AiJudgeConfigurationValidatorModelResult = {
      summary: "The rubric is usable but could be more specific.",
      issues: [
        {
          code: "example_specificity",
          severity: "warning",
          target: { type: "scoreGuidance", ref: "C1", score: 1 },
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
    expect(result).toEqual({ ...modelResult, passed: true });
  });

  it("derives a failure when any finding has error severity", async () => {
    const modelResult: AiJudgeConfigurationValidatorModelResult = {
      summary: "One score level is ambiguous.",
      issues: [
        {
          code: "guidance_overlap",
          severity: "error",
          target: { type: "criterion", ref: "C1" },
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
    ).resolves.toEqual({ ...modelResult, passed: false });
  });

  it.each([
    {
      target: { type: "criterion" as const, ref: "C9" as const },
      error: "Validator referenced unknown criterion C9",
    },
    {
      target: { type: "scoreGuidance" as const, ref: "C1" as const, score: 4 },
      error: "Validator referenced unknown score 4 for criterion C1",
    },
    {
      target: { type: "blockingError" as const, ref: "B9" as const },
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
    } as AiJudgeConfigurationValidatorModelResult;
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
