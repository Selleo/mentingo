import { AI_MENTOR_TYPE } from "@repo/shared";

import { AI_JUDGE_GENERATION_MODE } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.types";

import { AiPracticeJudgeConfigurationService } from "./ai-practice-judge-configuration.service";
import { AiPracticeService } from "./ai-practice.service";

import type { GeneratedAiJudgeConfiguration } from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";
import type { AiJudgeConfigurationGeneratorService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-generator.service";

describe("AiPracticeService", () => {
  it("generates the practice Judge configuration once without semantic validation", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000001";
    const scenario = "Practice negotiating a delivery deadline with a customer.";
    const configuration: GeneratedAiJudgeConfiguration = {
      taskGoal: "Reach a clear agreement.",
      passingThresholdPercent: 70,
      criteria: [],
      blockingErrors: [],
    };
    const content = {
      title: "Delivery deadline negotiation",
      aiMentorName: "Jordan, delivery lead",
      instructions: [
        "AI Mentor role: Customer concerned about a delayed delivery.",
        "Learner role: Account manager negotiating a delivery date.",
        "Situation: A customer calls after learning that an important delivery may be late.",
        "Learner goal: Agree on a realistic next step while preserving trust.",
        "Opening context: The customer has just joined the call and asks for an explanation.",
      ].join("\n"),
    };
    const repository = {
      findPracticeSessionById: jest.fn().mockResolvedValue({
        id: sessionId,
        userId: "00000000-0000-0000-0000-000000000002",
        practiceDate: "2026-08-06",
        language: "en",
        title: null,
        instructions: scenario,
        status: "queued",
        errorCode: null,
        threadId: null,
      }),
      claimPracticeSessionForGeneration: jest.fn().mockResolvedValue({ id: sessionId }),
      saveGeneratedPractice: jest.fn().mockResolvedValue(undefined),
      updatePracticeSession: jest.fn().mockResolvedValue(undefined),
    };
    const generator = {
      generate: jest.fn().mockResolvedValue(configuration),
    };
    const contentGenerator = {
      generate: jest.fn().mockResolvedValue(content),
    };
    const aiService = {
      getPracticeThreadWithSetup: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AiPracticeService(
      repository as never,
      {} as never,
      new AiPracticeJudgeConfigurationService(),
      contentGenerator as never,
      generator as unknown as AiJudgeConfigurationGeneratorService,
      aiService as never,
      {} as never,
    );

    await service.processGenerationJob({
      tenantId: "00000000-0000-0000-0000-000000000003",
      sessionId,
    });

    expect(generator.generate).toHaveBeenCalledTimes(1);
    expect(generator.generate).toHaveBeenCalledWith({
      language: "en",
      lessonContext: {
        title: content.title,
        taskDescription: content.instructions,
        aiMentorInstructions: content.instructions,
        aiMentorType: AI_MENTOR_TYPE.ROLEPLAY,
      },
      mode: AI_JUDGE_GENERATION_MODE.CREATE,
      brief: content.instructions,
    });
    expect(repository.saveGeneratedPractice).toHaveBeenCalledWith(
      sessionId,
      content.title,
      content.aiMentorName,
      content.instructions,
      expect.objectContaining({
        configuration: expect.objectContaining({ practiceSessionId: sessionId }),
      }),
    );
    expect(aiService.getPracticeThreadWithSetup).toHaveBeenCalledTimes(1);
    expect(aiService.getPracticeThreadWithSetup).toHaveBeenCalledWith({
      practiceSessionId: sessionId,
      userId: "00000000-0000-0000-0000-000000000002",
      userLanguage: "en",
      practiceInstructions: content.instructions,
    });
  });

  it("replays a completed practice with the same generated instructions", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000001";
    const userId = "00000000-0000-0000-0000-000000000002";
    const instructions =
      "AI Mentor role: Concerned customer.\nOpening context: Ask for an explanation.";
    const session = {
      id: sessionId,
      userId,
      practiceDate: "2026-08-06",
      language: "en",
      title: "Delivery deadline negotiation",
      instructions,
      status: "ready",
      errorCode: null,
      threadId: "00000000-0000-0000-0000-000000000004",
      threadStatus: "completed",
      taskGoal: "Reach a clear agreement.",
      evaluation: null,
    };
    const repository = {
      findPracticeSessionById: jest
        .fn()
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce({
          ...session,
          threadId: "00000000-0000-0000-0000-000000000005",
          threadStatus: "active",
        }),
      resetPracticeConversation: jest.fn().mockResolvedValue(undefined),
    };
    const aiService = {
      getPracticeThreadWithSetup: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AiPracticeService(
      repository as never,
      {} as never,
      new AiPracticeJudgeConfigurationService(),
      {} as never,
      {} as never,
      aiService as never,
      {} as never,
    );

    const replayed = await service.replay(sessionId, {
      userId,
      tenantId: "00000000-0000-0000-0000-000000000003",
    } as never);

    expect(repository.resetPracticeConversation).toHaveBeenCalledWith(sessionId);
    expect(aiService.getPracticeThreadWithSetup).toHaveBeenCalledWith({
      practiceSessionId: sessionId,
      userId,
      userLanguage: "en",
      practiceInstructions: instructions,
    });
    expect(replayed.threadStatus).toBe("active");
    expect(replayed.evaluation).toBeNull();
  });
});
