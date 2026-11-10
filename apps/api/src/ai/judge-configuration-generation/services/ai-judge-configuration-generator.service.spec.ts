import { AI_MENTOR_ROLEPLAY_DIFFICULTY, AI_MENTOR_TYPE, SUPPORTED_LANGUAGES } from "@repo/shared";

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
  aiMentorConfiguration: {
    type: AI_MENTOR_TYPE.ROLEPLAY,
    scenario: "A buyer challenges the price of the proposed solution.",
    aiRole: "Skeptical buyer",
    learnerRole: "Sales representative",
    characterGoal: "Understand whether the proposal justifies its price.",
    difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
    additionalInstructions: "Raise a credible budget objection.",
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
      getOpenAI: jest.fn().mockResolvedValue((model: string) => model),
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
    const [{ model, system, prompt, providerOptions, temperature }] = generateText.mock.calls[0];
    expect(model).toBe("gpt-6-luna");
    expect(temperature).toBeUndefined();
    expect(system).toBe("BASE\n\nMODE:aiJudgeConfigurationGeneratorCreate");
    expect(providerOptions).toEqual({
      openai: { reasoningEffort: "medium", forceReasoning: true },
    });
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
  it("removes a targeted blocker without rewriting the unaffected criterion or learner task", async () => {
    const { service } = createService({
      ...configuration,
      taskGoal: "A different participant now performs the task.",
      passingThresholdPercent: 80,
      criteria: [{ ...configuration.criteria[0], title: "Unrequested rewrite" }],
      blockingErrors: [],
    });
    const result = await service.generate({
      mode: "repair",
      language: SUPPORTED_LANGUAGES.EN,
      lessonContext,
      currentConfiguration: configuration,
      blockingIssues: [
        {
          code: "ordinary_omission",
          severity: "error",
          target: { type: "blockingError", ref: "B1" },
          message: "This is ordinary weak performance.",
          correction: "Remove this blocker.",
        },
      ],
    });
    expect(result).toEqual({ ...configuration, blockingErrors: [] });
  });

  it("applies a targeted example repair while retaining other guidance and authored fields", async () => {
    const criterion = configuration.criteria[0];
    const { service } = createService({
      ...configuration,
      criteria: [
        {
          ...criterion,
          title: "Unrequested rewrite",
          scoreGuidance: criterion.scoreGuidance.map((guidance) => ({
            ...guidance,
            description: "Unrequested restyling",
            example: "What matters most to you?",
          })),
        },
      ],
      blockingErrors: [],
    });
    const result = await service.generate({
      mode: "repair",
      language: SUPPORTED_LANGUAGES.EN,
      lessonContext,
      currentConfiguration: configuration,
      blockingIssues: [
        {
          code: "wrong_speaker",
          severity: "error",
          target: { type: "scoreGuidance", ref: "C1", score: 1, field: "example" },
          message: "The example includes the counterpart.",
          correction: "Use only learner speech.",
        },
      ],
    });
    expect(result).toEqual({
      ...configuration,
      criteria: [
        {
          ...criterion,
          scoreGuidance: [
            criterion.scoreGuidance[0],
            { ...criterion.scoreGuidance[1], example: "What matters most to you?" },
          ],
        },
      ],
    });
  });

  it("does not invent criteria or rebuild a rubric when repair findings are empty", async () => {
    const { service } = createService({ ...configuration, criteria: [], blockingErrors: [] });
    const result = await service.generate({
      mode: "repair",
      language: SUPPORTED_LANGUAGES.EN,
      lessonContext,
      currentConfiguration: configuration,
      blockingIssues: [],
    });
    expect(result).toEqual(configuration);
  });
  it.each(["unknownField", "ref", "title"])(
    "ignores an unsupported blocker field target %s without deleting or rewriting the item",
    async (field) => {
      const { service } = createService({ ...configuration, blockingErrors: [] });
      const result = await service.generate({
        mode: "repair",
        language: SUPPORTED_LANGUAGES.EN,
        lessonContext,
        currentConfiguration: configuration,
        blockingIssues: [
          {
            code: "invalid_target",
            severity: "error",
            target: { type: "blockingError", ref: "B1", field },
            message: "A field needs repair.",
            correction: "Correct the targeted field.",
          },
        ],
      });
      expect(result).toEqual(configuration);
    },
  );

  it("does not delete a blocker for a narrow description-only repair", async () => {
    const { service } = createService({ ...configuration, blockingErrors: [] });
    const result = await service.generate({
      mode: "repair",
      language: SUPPORTED_LANGUAGES.EN,
      lessonContext,
      currentConfiguration: configuration,
      blockingIssues: [
        {
          code: "description_ambiguity",
          severity: "error",
          target: { type: "blockingError", ref: "B1", field: "description" },
          message: "The description needs clarification.",
          correction: "Clarify the boundary.",
        },
      ],
    });
    expect(result).toEqual(configuration);
  });
});
