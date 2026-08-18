import { AI_MENTOR_CONFIGURATION_GENERATION_MODE, AI_MENTOR_TYPE } from "@repo/shared";

import { AI_JUDGE_GENERATION_MODE } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.types";

import { AiPracticeService } from "./ai-practice.service";

import type { GeneratedAiJudgeConfiguration } from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";
import type { AiJudgeConfigurationGeneratorService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-generator.service";
import type { AiMentorConfigurationGeneratorService } from "src/ai/mentor-configuration-generation/services/ai-mentor-configuration-generator.service";

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
    const mentorConfiguration = {
      type: AI_MENTOR_TYPE.ROLEPLAY,
      scenario: "A customer calls about an important delivery that may be late.",
      aiRole: "Customer concerned about a delayed delivery",
      learnerRole: "Account manager",
      characterGoal: "Get a credible recovery plan and protect the customer's deadline.",
      difficulty: "realistic",
      factsAndConstraints: null,
      openingInstruction: "Ask the account manager to explain the delay.",
      additionalInstructions: null,
    } as const;
    const repository = {
      findPracticeSessionById: jest.fn().mockResolvedValue({
        id: sessionId,
        userId: "00000000-0000-0000-0000-000000000002",
        practiceDate: "2026-08-06",
        language: "en",
        title: null,
        scenario,
        status: "queued",
        errorCode: null,
        threadId: null,
      }),
      claimPracticeSessionForGeneration: jest.fn().mockResolvedValue({ id: sessionId }),
      saveGeneratedPractice: jest.fn().mockResolvedValue(undefined),
      updatePracticeSession: jest.fn().mockResolvedValue(undefined),
    };
    const judgeGenerator = {
      generate: jest.fn().mockResolvedValue(configuration),
    };
    const mentorGenerator = {
      generate: jest.fn().mockResolvedValue(mentorConfiguration),
    };
    const aiService = {
      getPracticeThreadWithSetup: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AiPracticeService(
      repository as never,
      {} as never,
      mentorGenerator as unknown as AiMentorConfigurationGeneratorService,
      judgeGenerator as unknown as AiJudgeConfigurationGeneratorService,
      aiService as never,
      {} as never,
    );

    await service.processGenerationJob({
      tenantId: "00000000-0000-0000-0000-000000000003",
      sessionId,
    });

    expect(mentorGenerator.generate).toHaveBeenCalledWith({
      configurationType: AI_MENTOR_TYPE.ROLEPLAY,
      language: "en",
      lessonContext: {
        title: scenario,
        taskDescription: scenario,
      },
      mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
      brief: scenario,
    });
    expect(judgeGenerator.generate).toHaveBeenCalledTimes(1);
    expect(judgeGenerator.generate).toHaveBeenCalledWith({
      language: "en",
      lessonContext: {
        title: scenario,
        taskDescription: scenario,
        aiMentorConfiguration: mentorConfiguration,
      },
      mode: AI_JUDGE_GENERATION_MODE.CREATE,
      brief: scenario,
    });
    expect(repository.saveGeneratedPractice).toHaveBeenCalledWith(
      sessionId,
      scenario,
      mentorConfiguration.aiRole,
      expect.objectContaining({
        configuration: expect.objectContaining({
          practiceSessionId: sessionId,
          type: AI_MENTOR_TYPE.ROLEPLAY,
        }),
        roleplayConfiguration: expect.objectContaining({
          scenario: expect.objectContaining({ queryChunks: expect.any(Array) }),
          aiRole: expect.objectContaining({ queryChunks: expect.any(Array) }),
        }),
      }),
      expect.objectContaining({
        configuration: expect.objectContaining({ practiceSessionId: sessionId }),
      }),
    );
    expect(aiService.getPracticeThreadWithSetup).toHaveBeenCalledTimes(1);
    expect(aiService.getPracticeThreadWithSetup).toHaveBeenCalledWith({
      practiceSessionId: sessionId,
      userId: "00000000-0000-0000-0000-000000000002",
      userLanguage: "en",
    });
  });

  it("replays a completed practice with its persisted structured configuration", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000001";
    const userId = "00000000-0000-0000-0000-000000000002";
    const session = {
      id: sessionId,
      userId,
      practiceDate: "2026-08-06",
      language: "en",
      title: "Delivery deadline negotiation",
      scenario: "Practice negotiating a delivery deadline with a customer.",
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
    });
    expect(replayed.threadStatus).toBe("active");
    expect(replayed.evaluation).toBeNull();
  });
});
