import { AiCapability, AiCapabilityMode, AiCapabilityProvider } from "@japro/luma-sdk";

import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";

import type { AiJudgeModelResult } from "src/ai/judge-configuration/judge-configuration.types";
import type { EnvService } from "src/env/services/env.service";

describe("AiRuntimeService", () => {
  const judgeInput = {
    messages: [
      { role: "system" as const, content: "Judge using C1 and B1." },
      { role: "user" as const, content: "Learner response" },
    ],
    temperature: 0.2,
  };
  const authoringInput = {
    messages: [
      { role: "system" as const, content: "Author the rubric." },
      { role: "user" as const, content: "Assess discovery skills." },
    ],
    temperature: 0,
  };
  const generatedConfiguration = {
    taskGoal: "The learner uncovers the customer's needs.",
    passingThresholdPercent: 70,
    criteria: [
      {
        ref: "C1",
        title: "Discovers needs",
        expectedBehavior: "Asks questions about the customer's situation.",
        maxScore: 1,
        scoreGuidance: [
          { score: 0, description: "Does not ask a discovery question.", example: null },
          {
            score: 1,
            description: "Asks a relevant discovery question.",
            example: "What are you trying to improve?",
          },
        ],
      },
    ],
    blockingErrors: [],
  };
  const generatedMentorConfiguration = {
    scenario: "A customer challenges a delayed delivery.",
    aiRole: "Marek, the customer",
    learnerRole: "Customer support specialist",
    characterGoal: "Obtain a credible resolution date.",
    difficulty: "realistic" as const,
    factsAndConstraints: null,
    openingInstruction: null,
    additionalInstructions: null,
  };

  it("uses the Core Judge fallback with the structured result contract", async () => {
    const service = new AiRuntimeService({} as EnvService);
    const coreResult: AiJudgeModelResult = {
      criterionResults: [
        {
          criterionRef: "C1",
          awardedScore: 3,
          learnerSafeFeedback: "The learner addressed the configured behavior.",
        },
      ],
      triggeredBlockingErrors: [
        {
          blockingErrorRef: "B1",
          learnerSafeFeedback: "The learner made an unsupported promise.",
        },
      ],
    };
    const judgeCore = jest.fn().mockResolvedValue(coreResult);
    jest.spyOn(service, "resolveSource").mockResolvedValue(AI_RUNTIME_SOURCES.CORE);

    const result = await service.judgeMentor(judgeInput, judgeCore);

    expect(service.resolveSource).toHaveBeenCalledWith(AiCapability.AiMentorJudge);
    expect(judgeCore).toHaveBeenCalledTimes(1);
    expect(result).toEqual(coreResult);
  });

  it("resolves the Judge source from the configured AI Mentor Judge capability", async () => {
    const service = new AiRuntimeService({} as EnvService);
    const getLumaConfiguration = jest.fn().mockResolvedValue({
      capabilities: {
        [AiCapability.AiMentorJudge]: {
          enabled: true,
          mode: AiCapabilityMode.Custom,
          provider: AiCapabilityProvider.Luma,
        },
      },
    });
    Object.defineProperty(service, "getLumaConfiguration", {
      configurable: true,
      value: getLumaConfiguration,
    });

    await expect(service.resolveSource(AiCapability.AiMentorJudge)).resolves.toBe(
      AI_RUNTIME_SOURCES.LUMA,
    );
    expect(getLumaConfiguration).toHaveBeenCalledTimes(1);
  });

  it("uses the configured Luma Judge when it returns structured evidence", async () => {
    const service = new AiRuntimeService({} as EnvService);
    const lumaResult: AiJudgeModelResult = {
      criterionResults: [
        {
          criterionRef: "C1",
          awardedScore: 2,
          learnerSafeFeedback: "The learner partially demonstrated the behavior.",
        },
      ],
      triggeredBlockingErrors: [],
    };
    const judgeCore = jest.fn<Promise<AiJudgeModelResult>, []>();
    const judgeLuma = jest.fn().mockResolvedValue(lumaResult);
    const getLumaClient = jest.fn().mockResolvedValue({ mentor: { judge: judgeLuma } });
    jest.spyOn(service, "resolveSource").mockResolvedValue(AI_RUNTIME_SOURCES.LUMA);
    Object.defineProperty(service, "getLumaClient", {
      configurable: true,
      value: getLumaClient,
    });

    const result = await service.judgeMentor(judgeInput, judgeCore);

    expect(judgeLuma).toHaveBeenCalledWith(judgeInput);
    expect(judgeCore).not.toHaveBeenCalled();
    expect(result).toEqual(lumaResult);
  });

  it("falls back to Core when Luma returns the legacy Judge shape", async () => {
    const service = new AiRuntimeService({} as EnvService);
    const coreResult: AiJudgeModelResult = {
      criterionResults: [],
      triggeredBlockingErrors: [],
    };
    const judgeCore = jest.fn().mockResolvedValue(coreResult);
    const judgeLuma = jest.fn().mockResolvedValue({
      summary: "Legacy response",
      passed: true,
      minScore: 0,
      score: 0,
      maxScore: 0,
      percentage: 100,
    });
    const getLumaClient = jest.fn().mockResolvedValue({ mentor: { judge: judgeLuma } });
    jest.spyOn(service, "resolveSource").mockResolvedValue(AI_RUNTIME_SOURCES.LUMA);
    Object.defineProperty(service, "getLumaClient", {
      configurable: true,
      value: getLumaClient,
    });

    const result = await service.judgeMentor(judgeInput, judgeCore);

    expect(judgeLuma).toHaveBeenCalledWith(judgeInput);
    expect(getLumaClient).toHaveBeenCalledTimes(1);
    expect(judgeCore).toHaveBeenCalledTimes(1);
    expect(result).toEqual(coreResult);
  });

  it("uses Luma for AI Judge configuration generation", async () => {
    const service = new AiRuntimeService({} as EnvService);
    const generateCore = jest.fn();
    const generateJudgeConfiguration = jest.fn().mockResolvedValue(generatedConfiguration);
    jest.spyOn(service, "resolveSource").mockResolvedValue(AI_RUNTIME_SOURCES.LUMA);
    Object.defineProperty(service, "getLumaClient", {
      configurable: true,
      value: jest.fn().mockResolvedValue({ ai: { generateJudgeConfiguration } }),
    });

    const result = await service.generateJudgeConfiguration(authoringInput, generateCore);

    expect(service.resolveSource).toHaveBeenCalledWith(AiCapability.AiJudgeConfigurationGenerator);
    expect(generateJudgeConfiguration).toHaveBeenCalledWith(authoringInput);
    expect(generateCore).not.toHaveBeenCalled();
    expect(result).toEqual(generatedConfiguration);
  });

  it("uses Luma for AI Mentor configuration generation", async () => {
    const service = new AiRuntimeService({} as EnvService);
    const generateCore = jest.fn();
    const generateMentorConfiguration = jest.fn().mockResolvedValue(generatedMentorConfiguration);
    jest.spyOn(service, "resolveSource").mockResolvedValue(AI_RUNTIME_SOURCES.LUMA);
    Object.defineProperty(service, "getLumaClient", {
      configurable: true,
      value: jest.fn().mockResolvedValue({ ai: { generateMentorConfiguration } }),
    });
    const input = { ...authoringInput, configurationType: "roleplay" as const };

    const result = await service.generateMentorConfiguration(input, generateCore);

    expect(service.resolveSource).toHaveBeenCalledWith(AiCapability.AiMentorConfigurationGenerator);
    expect(generateMentorConfiguration).toHaveBeenCalledWith(input);
    expect(generateCore).not.toHaveBeenCalled();
    expect(result).toEqual(generatedMentorConfiguration);
  });

  it("falls back to Core when Luma AI Mentor configuration generation is invalid", async () => {
    const service = new AiRuntimeService({} as EnvService);
    const generateCore = jest.fn().mockResolvedValue(generatedMentorConfiguration);
    jest.spyOn(service, "resolveSource").mockResolvedValue(AI_RUNTIME_SOURCES.LUMA);
    Object.defineProperty(service, "getLumaClient", {
      configurable: true,
      value: jest.fn().mockResolvedValue({
        ai: { generateMentorConfiguration: jest.fn().mockResolvedValue({ scenario: "partial" }) },
      }),
    });

    await expect(
      service.generateMentorConfiguration(
        { ...authoringInput, configurationType: "roleplay" },
        generateCore,
      ),
    ).resolves.toEqual(generatedMentorConfiguration);
    expect(generateCore).toHaveBeenCalledTimes(1);
  });

  it("falls back to Core when Luma AI Judge configuration generation fails", async () => {
    const service = new AiRuntimeService({} as EnvService);
    const coreConfiguration = { ...generatedConfiguration, passingThresholdPercent: 80 };
    const generateCore = jest.fn().mockResolvedValue(coreConfiguration);
    jest.spyOn(service, "resolveSource").mockResolvedValue(AI_RUNTIME_SOURCES.LUMA);
    Object.defineProperty(service, "getLumaClient", {
      configurable: true,
      value: jest.fn().mockResolvedValue({
        ai: { generateJudgeConfiguration: jest.fn().mockRejectedValue(new Error("offline")) },
      }),
    });

    await expect(service.generateJudgeConfiguration(authoringInput, generateCore)).resolves.toEqual(
      coreConfiguration,
    );
    expect(generateCore).toHaveBeenCalledTimes(1);
  });

  it("falls back to Core when Luma translation generation returns an invalid result", async () => {
    const service = new AiRuntimeService({} as EnvService);

    const input = {
      messages: [{ role: "user" as const, content: "Translate this" }],
      temperature: 0,
    };
    const coreResult = { translations: ["translation-item-1\nTłumaczenie"] };
    const generateCore = jest.fn().mockResolvedValue(coreResult);
    const generateTranslations = jest.fn().mockResolvedValue({ translations: [null] });

    jest.spyOn(service, "resolveSource").mockResolvedValue(AI_RUNTIME_SOURCES.LUMA);
    Object.defineProperty(service, "getLumaClient", {
      configurable: true,
      value: jest.fn().mockResolvedValue({ ai: { generateTranslations } }),
    });

    await expect(service.generateTranslations(input, generateCore)).resolves.toEqual(coreResult);
    expect(generateTranslations).toHaveBeenCalledWith(input);
    expect(generateCore).toHaveBeenCalledTimes(1);
  });

  it("uses Luma for AI Judge configuration validation", async () => {
    const service = new AiRuntimeService({} as EnvService);
    const validation = { summary: "The rubric is ready.", issues: [] };
    const validateCore = jest.fn();
    const validateJudgeConfiguration = jest.fn().mockResolvedValue(validation);
    jest.spyOn(service, "resolveSource").mockResolvedValue(AI_RUNTIME_SOURCES.LUMA);
    Object.defineProperty(service, "getLumaClient", {
      configurable: true,
      value: jest.fn().mockResolvedValue({ ai: { validateJudgeConfiguration } }),
    });

    const result = await service.validateJudgeConfiguration(authoringInput, validateCore);

    expect(service.resolveSource).toHaveBeenCalledWith(AiCapability.AiJudgeConfigurationValidator);
    expect(validateJudgeConfiguration).toHaveBeenCalledWith(authoringInput);
    expect(validateCore).not.toHaveBeenCalled();
    expect(result).toEqual(validation);
  });

  it("falls back to Core when Luma AI Judge configuration validation is invalid", async () => {
    const service = new AiRuntimeService({} as EnvService);
    const coreValidation = { summary: "Core validation result.", issues: [] };
    const validateCore = jest.fn().mockResolvedValue(coreValidation);
    jest.spyOn(service, "resolveSource").mockResolvedValue(AI_RUNTIME_SOURCES.LUMA);
    Object.defineProperty(service, "getLumaClient", {
      configurable: true,
      value: jest.fn().mockResolvedValue({
        ai: {
          validateJudgeConfiguration: jest.fn().mockResolvedValue({ summary: "Missing issues" }),
        },
      }),
    });

    await expect(service.validateJudgeConfiguration(authoringInput, validateCore)).resolves.toEqual(
      coreValidation,
    );
    expect(validateCore).toHaveBeenCalledTimes(1);
  });
});
