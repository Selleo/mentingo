import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { loadAiSdk } from "src/ai/utils/ai-esm";

import { AiJudgeConfigurationGeneratorService } from "./ai-judge-configuration-generator.service";

import type { ReferencedAiJudgeConfiguration } from "../schemas/ai-judge-configuration-generation.schema";
import type { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import type { PromptService } from "src/ai/services/prompt.service";

jest.mock("@langfuse/tracing", () => ({
  observe: (callback: () => unknown) => callback,
  updateActiveObservation: jest.fn(),
}));
jest.mock("src/ai/utils/ai-esm", () => ({ loadAiSdk: jest.fn() }));

const lessonContext = {
  title: "Handle a price objection",
  taskDescription: "Reach an agreed next step.",
  aiMentorInstructions: "Act as a skeptical buyer.",
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
        { score: 0, description: "Does not investigate the objection.", example: null },
        {
          score: 1,
          description: "Clarifies the reason for the objection.",
          example: "What is driving the concern?",
        },
      ],
    },
  ],
  blockingErrors: [{ ref: "B1", description: "Invents contractual guarantees." }],
};

const readPayload = (prompt: string) => {
  const [, json] = prompt.match(/<input_json>\n(.+)\n<\/input_json>/s) ?? [];
  if (!json) throw new Error("Missing input JSON");

  return JSON.parse(json) as Record<string, unknown>;
};

describe("AiJudgeConfigurationGeneratorService", () => {
  const createService = (output: ReferencedAiJudgeConfiguration = configuration) => {
    const generateText = jest.fn().mockResolvedValue({ output });
    jest.mocked(loadAiSdk).mockResolvedValue({
      generateText,
      jsonSchema: jest.fn((schema) => schema),
      Output: { object: jest.fn((options) => options) },
    } as never);
    const promptService = {
      loadPrompt: jest.fn(async (id: string) => {
        if (id === "aiJudgeConfigurationGeneratorBase") return "BASE";
        return `MODE:${id}`;
      }),
      isNotEmpty: jest.fn().mockResolvedValue(undefined),
      getOpenAI: jest.fn().mockResolvedValue(jest.fn().mockReturnValue("MODEL")),
    };
    const aiRuntimeService = {
      generateJudgeConfiguration: jest.fn((_input, generateCoreConfiguration) =>
        generateCoreConfiguration(),
      ),
    };
    const service = new AiJudgeConfigurationGeneratorService(
      promptService as unknown as PromptService,
      aiRuntimeService as unknown as AiRuntimeService,
    );

    return { generateText, promptService, service };
  };

  it("composes create instructions without previous configuration context", async () => {
    const { generateText, promptService, service } = createService();

    const result = await service.generate({
      mode: "create",
      language: SUPPORTED_LANGUAGES.EN,
      lessonContext,
      brief: "Assess whether the learner can handle a price objection.",
    });

    expect(promptService.loadPrompt).toHaveBeenCalledWith("aiJudgeConfigurationGeneratorBase", {
      language: SUPPORTED_LANGUAGES.EN,
    });
    expect(promptService.loadPrompt).toHaveBeenCalledWith(
      "aiJudgeConfigurationGeneratorCreate",
      {},
    );
    const [{ system, prompt, providerOptions }] = generateText.mock.calls[0];
    expect(system).toBe("BASE\n\nMODE:aiJudgeConfigurationGeneratorCreate");
    expect(providerOptions).toEqual({ openai: { reasoningEffort: "medium" } });
    expect(readPayload(prompt)).toEqual({
      mode: "create",
      creatorBrief: "Assess whether the learner can handle a price objection.",
      lessonContext,
    });
    expect(result).toEqual(configuration);
  });

  it("passes the complete current draft and creator intent to improve mode", async () => {
    const { generateText, service } = createService();
    const latestValidation = {
      passed: true,
      summary: "Usable with one optional improvement.",
      issues: [],
    };

    await service.generate({
      mode: "improve",
      language: SUPPORTED_LANGUAGES.PL,
      lessonContext,
      brief: "Assess objection handling.",
      instruction: "Make partial performance more concrete.",
      currentConfiguration: configuration,
      latestValidation,
    });

    const [{ prompt }] = generateText.mock.calls[0];
    expect(readPayload(prompt)).toEqual({
      mode: "improve",
      creatorInstruction: "Make partial performance more concrete.",
      originalBrief: "Assess objection handling.",
      lessonContext,
      currentConfiguration: configuration,
      latestValidation,
    });
  });

  it("normalizes generated passing thresholds to a round ten-point increment", async () => {
    const { service } = createService({
      ...configuration,
      passingThresholdPercent: 67,
    });

    const result = await service.generate({
      mode: "create",
      language: SUPPORTED_LANGUAGES.EN,
      lessonContext,
      brief: "Assess whether the learner can handle a price objection.",
    });

    expect(result.passingThresholdPercent).toBe(70);
  });

  it("uses internal repair instructions with targeted blocking issues", async () => {
    const { generateText, promptService, service } = createService();
    const blockingIssues = [
      {
        code: "guidance_overlap",
        severity: "error" as const,
        target: { type: "scoreGuidance" as const, ref: "C1" as const, score: 1 },
        message: "The score levels are not distinct.",
        correction: "Describe the evidence unique to score 1.",
      },
    ];

    await service.generate({
      mode: "repair",
      language: SUPPORTED_LANGUAGES.EN,
      lessonContext,
      currentConfiguration: configuration,
      blockingIssues,
    });

    expect(promptService.loadPrompt).toHaveBeenCalledWith(
      "aiJudgeConfigurationGeneratorRepair",
      {},
    );
    const [{ prompt }] = generateText.mock.calls[0];
    expect(readPayload(prompt)).toEqual({
      mode: "repair",
      lessonContext,
      currentConfiguration: configuration,
      blockingIssues,
    });
  });
});
