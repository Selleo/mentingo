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
});
